import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { copyFile, mkdir, open, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { canonical, CATALOG_SQL } from "./backup-contract.mjs";

const quote = (value) => `"${value.replaceAll('"', '""')}"`;
const literal = (value) => `'${value.replaceAll("'", "''")}'`;
async function main() {
if (!process.argv[2]) throw new Error("Privates Restore-Ziel fehlt.");
const destination = path.resolve(process.argv[2] ?? "");
const name = `fcb-restore-${randomBytes(8).toString("hex")}`;
const containerPassword = randomBytes(32).toString("hex");
const log = await open(path.join(destination, "restore-private.log"), "wx", 0o600);
const manifest = JSON.parse(await readFile(path.join(destination, "backup.json"), "utf8"));
const storage = JSON.parse(await readFile(path.join(destination, "storage.json"), "utf8"));
let stage = "CONTAINER";
let failure = "UNBEKANNT";
function contract(condition) {
  if (!condition) { failure = "VERTRAG"; throw new Error(); }
}
function classify(text) {
  const state = /(?:ERROR|FATAL|PANIC):\s+([0-9A-Z]{5}):/.exec(text)?.[1];
  if (["28000", "28P01"].includes(state)) return "AUTH";
  if (["42501", "42502"].includes(state)) return "BERECHTIGUNG";
  if (["42710", "42P06", "42P07"].includes(state)) return "DUPLIKAT";
  if (["42704", "42P01", "3F000"].includes(state)) return "OBJEKT_FEHLT";
  if (state === "2BP01") return "ABHAENGIGKEIT";
  if (state === "0A000") return "KOMPATIBILITAET";
  if (state?.startsWith("23")) return "INTEGRITAET";
  if (/permission denied|must be (?:owner|superuser)/i.test(text)) return "BERECHTIGUNG";
  if (/already exists|duplicate (?:key|object)/i.test(text)) return "DUPLIKAT";
  if (/does not exist|undefined (?:table|object|function)/i.test(text)) return "OBJEKT_FEHLT";
  if (/dependent objects|depends on/i.test(text)) return "ABHAENGIGKEIT";
  if (/unsupported version|not supported/i.test(text)) return "KOMPATIBILITAET";
  return "UNBEKANNT";
}
function policyDifferences(expected, actual) {
  const identity = (policy) => JSON.stringify([policy.schemaname, policy.tablename, policy.policyname]);
  const expectedByIdentity = new Map(expected.map((policy) => [identity(policy), policy]));
  const actualByIdentity = new Map(actual.map((policy) => [identity(policy), policy]));
  const fields = ["permissive", "roles", "cmd", "qual", "with_check"];
  const counts = Object.fromEntries(fields.map((field) => [field, 0]));
  let roleOrderOnly = 0;
  let missing = 0;
  for (const [key, policy] of expectedByIdentity) {
    const restored = actualByIdentity.get(key);
    if (!restored) { missing++; continue; }
    for (const field of fields) {
      if (canonical(policy[field]) !== canonical(restored[field])) {
        counts[field]++;
        if (field === "roles" && Array.isArray(policy.roles) && Array.isArray(restored.roles) && canonical([...policy.roles].sort()) === canonical([...restored.roles].sort())) roleOrderOnly++;
      }
    }
  }
  // Nur feste Feldnamen und Zähler, niemals Identitäten oder Policy-Inhalte ausgeben.
  console.error(`Policy-Differenz: erwartet=${expected.length}; wiederhergestellt=${actual.length}; fehlende_Identitaeten=${missing}; policies_nur_Reihenfolge=${onlyOrderDiffers(expected, actual)}; permissive=${counts.permissive}; roles=${counts.roles}; roles_nur_Reihenfolge=${roleOrderOnly}; cmd=${counts.cmd}; qual=${counts.qual}; with_check=${counts.with_check}.`);
}
function onlyOrderDiffers(expected, actual) {
  return Array.isArray(expected) && Array.isArray(actual) && canonical(expected) !== canonical(actual)
    && canonical(expected.map(canonical).sort()) === canonical(actual.map(canonical).sort());
}
function catalogDifferences(expected, actual) {
  const fields = ["functions", "triggers", "constraints", "grants", "sequences"];
  const differences = fields.map((field) => {
    const before = expected[field];
    const after = actual[field];
    if (!Array.isArray(before) || !Array.isArray(after)) return `${field}=unbekannt`;
    return `${field}_erwartet=${before.length},${field}_wiederhergestellt=${after.length},${field}_gleich=${canonical(before) === canonical(after)},${field}_nur_Reihenfolge=${onlyOrderDiffers(before, after)}`;
  });
  console.error(`Katalog-Differenz: ${differences.join("; ")}.`);
}
function docker(args, input) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 600_000, stdio: ["pipe", "pipe", log.fd] });
  if (result.error?.code === "ETIMEDOUT") failure = "ZEITLIMIT";
  if (result.status !== 0) throw new Error("Isolierte Wiederherstellung fehlgeschlagen.");
  return result.stdout.trim();
}
function sql(query, database = "isolated_restore") {
  return docker(["exec", "-i", "-e", `PGPASSWORD=${containerPassword}`, name, "psql", "-XqAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-U", "supabase_admin", "-d", database], `SET search_path = public, extensions;\n${query}`);
}
try {
  contract(manifest.schemaVersion === 2 && /^17\./.test(manifest.serverVersion) && manifest.vaultSecrets === 0 && /^supabase\/postgres@sha256:[a-f0-9]{64}$/.test(manifest.postgresImage ?? ""));
  // Für ältere FCB-Backups wurde dieser effektive Quellpfad nachträglich geprüft;
  // das frühere Manifest selbst enthält keinen Suchpfad.
  contract(manifest.metadataSearchPath === undefined
    ? manifest.projectRef === "jktvmckqfklfziszfsxf"
    : canonical(manifest.metadataSearchPath) === canonical(["public", "extensions"]));
  docker(["run", "--detach", "--name", name, "--network", "none", "--memory", "2g", "--cpus", "2", "--mount", `type=bind,source=${destination},target=/backup,readonly`, "-e", `POSTGRES_PASSWORD=${containerPassword}`, manifest.postgresImage]);
  stage = "READY";
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    // Der temporäre Initialisierungsserver lauscht nur am Unix-Socket und fährt
    // nochmals herunter. TCP auf Loopback bestätigt erst den endgültigen Server.
    const status = spawnSync("docker", ["exec", "-e", `PGPASSWORD=${containerPassword}`, name, "psql", "-XqAtw", "-h", "127.0.0.1", "-U", "supabase_admin", "-d", "postgres", "-c", "SELECT 1"], { stdio: "ignore", timeout: 5000 });
    if (status.status === 0) { ready = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!ready) { failure = "ZEITLIMIT"; throw new Error(); }
  contract(docker(["inspect", "--format", "{{.HostConfig.NetworkMode}}", name]) === "none");
  stage = "ROLLEN";
  // Nur fehlende Rollen anlegen, ohne produktive Passwörter oder LOGIN zu übernehmen.
  for (const role of manifest.roles) {
    const attributes = [role.superuser ? "SUPERUSER" : "NOSUPERUSER", role.inherit ? "INHERIT" : "NOINHERIT", role.createRole ? "CREATEROLE" : "NOCREATEROLE", role.createDb ? "CREATEDB" : "NOCREATEDB", role.replication ? "REPLICATION" : "NOREPLICATION", role.bypassRls ? "BYPASSRLS" : "NOBYPASSRLS", "NOLOGIN"].join(" ");
    sql(`DO $restore$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname=${literal(role.name)}) THEN CREATE ROLE ${quote(role.name)} WITH ${attributes}; END IF; END $restore$;`, "postgres");
  }
  stage = "MITGLIEDSCHAFTEN";
  for (const membership of manifest.memberships) sql(`GRANT ${quote(membership.role)} TO ${quote(membership.member)} WITH ADMIN ${membership.admin ? "TRUE" : "FALSE"}, INHERIT ${membership.inherit ? "TRUE" : "FALSE"}, SET ${membership.set ? "TRUE" : "FALSE"};`, "postgres");
  stage = "DBANLAGE";
  sql("CREATE DATABASE isolated_restore TEMPLATE template0;", "postgres");
  // pg_dump setzt das Standardschema public voraus. Die neue template0-Datenbank
  // enthält dort keine Anwendungsobjekte, das Schema muss für den Restore bleiben.
  stage = "PG_RESTORE";
  docker(["exec", "-e", `PGPASSWORD=${containerPassword}`, name, "pg_restore", "--exit-on-error", "--single-transaction", "--username=supabase_admin", "--dbname=isolated_restore", "/backup/database.dump"]);
  stage = "TABELLEN";
  for (const table of manifest.tables) {
    const state = JSON.parse(sql(`SELECT json_build_object('rows',(SELECT count(*) FROM ${quote(table.schema)}.${quote(table.table)}),'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=${literal(table.schema)} AND c.relname=${literal(table.table)};`));
    contract(state.rows === table.rows && state.rls === table.rls && state.forceRls === table.forceRls);
  }
  stage = "POLICIES";
  const policies = JSON.parse(sql("SELECT coalesce(json_agg(p ORDER BY schemaname,tablename,policyname),'[]'::json) FROM pg_policies p WHERE schemaname NOT LIKE 'pg_%';"));
  if (canonical(policies) !== canonical(manifest.policies)) {
    policyDifferences(manifest.policies, policies);
    try { catalogDifferences(manifest.catalog, JSON.parse(sql(CATALOG_SQL))); }
    catch { console.error("Katalog-Diagnose nicht verfügbar."); }
  }
  contract(canonical(policies) === canonical(manifest.policies));
  stage = "KATALOG";
  contract(canonical(JSON.parse(sql(CATALOG_SQL))) === canonical(manifest.catalog));
  stage = "DATEIEN";
  const restoredFiles = path.join(destination, "isolated-files");
  await mkdir(restoredFiles, { mode: 0o700 });
  for (const object of storage.objects) {
    contract(/^[a-f0-9]{64}$/.test(object.file));
    const bytes = await readFile(path.join(destination, "objects", object.file));
    contract(bytes.length === object.bytes && createHash("sha256").update(bytes).digest("hex") === object.sha256);
    const count = JSON.parse(sql(`SELECT to_json(count(*)) FROM storage.objects WHERE bucket_id=${literal(object.bucket)} AND name=${literal(object.name)} AND id::text=${literal(object.id)};`));
    contract(count === 1);
    await copyFile(path.join(destination, "objects", object.file), path.join(restoredFiles, object.file));
  }
  await writeFile(path.join(destination, "restore-proof.json"), JSON.stringify({ verifiedAt: new Date().toISOString(), databaseRestored: true, network: "none", tablesCompared: manifest.tables.length, policiesCompared: policies.length, catalogCompared: true, filesCompared: storage.objects.length, applicationFlowsVerified: false }), { mode: 0o600 });
  console.log("Isolierter Datenbank-Restore, RLS und Storage-Dateiprüfung erfolgreich. Keine App-Anmeldung oder Storage-API geprüft.");
} catch {
  if (failure === "UNBEKANNT") {
    try { failure = classify(await readFile(path.join(destination, "restore-private.log"), "utf8")); } catch { /* Private Diagnose bleibt unzugänglich. */ }
  }
  console.error(`Isolierter Restore fehlgeschlagen. Phase: ${stage}; Klasse: ${failure}. Keine privaten Diagnosedaten veröffentlicht.`);
  process.exitCode = 1;
} finally {
  spawnSync("docker", ["rm", "--force", "--volumes", name], { stdio: "ignore", timeout: 30_000 });
  await log.close();
}
}
await main().catch(() => { console.error("Isolierter Restore konnte nicht vorbereitet werden. Keine privaten Diagnosedaten veröffentlicht."); process.exitCode = 1; });
