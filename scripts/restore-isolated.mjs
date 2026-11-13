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
function docker(args, input) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 600_000, stdio: ["pipe", "pipe", log.fd] });
  if (result.status !== 0) throw new Error("Isolierte Wiederherstellung fehlgeschlagen.");
  return result.stdout.trim();
}
function sql(query, database = "isolated_restore") {
  return docker(["exec", "-i", "-e", `PGPASSWORD=${containerPassword}`, name, "psql", "-XqAt", "-v", "ON_ERROR_STOP=1", "-U", "supabase_admin", "-d", database], query);
}
try {
  if (manifest.schemaVersion !== 2 || !/^17\./.test(manifest.serverVersion) || manifest.vaultSecrets !== 0 || !/^supabase\/postgres@sha256:[a-f0-9]{64}$/.test(manifest.postgresImage ?? "")) throw new Error("Nicht unterstützter Sicherungsvertrag.");
  docker(["run", "--detach", "--name", name, "--network", "none", "--memory", "2g", "--cpus", "2", "--mount", `type=bind,source=${destination},target=/backup,readonly`, "-e", `POSTGRES_PASSWORD=${containerPassword}`, manifest.postgresImage]);
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    // Der temporäre Initialisierungsserver lauscht nur am Unix-Socket und fährt
    // nochmals herunter. TCP auf Loopback bestätigt erst den endgültigen Server.
    const status = spawnSync("docker", ["exec", "-e", `PGPASSWORD=${containerPassword}`, name, "psql", "-XqAtw", "-h", "127.0.0.1", "-U", "supabase_admin", "-d", "postgres", "-c", "SELECT 1"], { stdio: "ignore", timeout: 5000 });
    if (status.status === 0) { ready = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error("Isolierte Datenbank wurde nicht bereit.");
  if (docker(["inspect", "--format", "{{.HostConfig.NetworkMode}}", name]) !== "none") throw new Error("Netzwerkisolation fehlt.");
  // Nur fehlende Rollen anlegen, ohne produktive Passwörter oder LOGIN zu übernehmen.
  for (const role of manifest.roles) {
    const attributes = [role.superuser ? "SUPERUSER" : "NOSUPERUSER", role.inherit ? "INHERIT" : "NOINHERIT", role.createRole ? "CREATEROLE" : "NOCREATEROLE", role.createDb ? "CREATEDB" : "NOCREATEDB", role.replication ? "REPLICATION" : "NOREPLICATION", role.bypassRls ? "BYPASSRLS" : "NOBYPASSRLS", "NOLOGIN"].join(" ");
    sql(`DO $restore$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname=${literal(role.name)}) THEN CREATE ROLE ${quote(role.name)} WITH ${attributes}; END IF; END $restore$;`, "postgres");
  }
  for (const membership of manifest.memberships) sql(`GRANT ${quote(membership.role)} TO ${quote(membership.member)} WITH ADMIN ${membership.admin ? "TRUE" : "FALSE"}, INHERIT ${membership.inherit ? "TRUE" : "FALSE"}, SET ${membership.set ? "TRUE" : "FALSE"};`, "postgres");
  sql("CREATE DATABASE isolated_restore TEMPLATE template0;", "postgres");
  // pg_dump setzt das Standardschema public voraus. Die neue template0-Datenbank
  // enthält dort keine Anwendungsobjekte, das Schema muss für den Restore bleiben.
  docker(["exec", "-e", `PGPASSWORD=${containerPassword}`, name, "pg_restore", "--exit-on-error", "--single-transaction", "--username=supabase_admin", "--dbname=isolated_restore", "/backup/database.dump"]);
  for (const table of manifest.tables) {
    const state = JSON.parse(sql(`SELECT json_build_object('rows',(SELECT count(*) FROM ${quote(table.schema)}.${quote(table.table)}),'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=${literal(table.schema)} AND c.relname=${literal(table.table)};`));
    if (state.rows !== table.rows || state.rls !== table.rls || state.forceRls !== table.forceRls) throw new Error("Tabellenstand oder RLS weicht ab.");
  }
  const policies = JSON.parse(sql("SELECT coalesce(json_agg(p ORDER BY schemaname,tablename,policyname),'[]'::json) FROM pg_policies p WHERE schemaname NOT LIKE 'pg_%';"));
  if (canonical(policies) !== canonical(manifest.policies)) throw new Error("RLS-Policies weichen ab.");
  if (canonical(JSON.parse(sql(CATALOG_SQL))) !== canonical(manifest.catalog)) throw new Error("Funktionen, Trigger, Constraints, Grants oder Sequenzen weichen ab.");
  const restoredFiles = path.join(destination, "isolated-files");
  await mkdir(restoredFiles, { mode: 0o700 });
  for (const object of storage.objects) {
    if (!/^[a-f0-9]{64}$/.test(object.file)) throw new Error("Ungültiger Objektdateiname.");
    const bytes = await readFile(path.join(destination, "objects", object.file));
    if (bytes.length !== object.bytes || createHash("sha256").update(bytes).digest("hex") !== object.sha256) throw new Error("Storage-Prüfsumme weicht ab.");
    const count = JSON.parse(sql(`SELECT to_json(count(*)) FROM storage.objects WHERE bucket_id=${literal(object.bucket)} AND name=${literal(object.name)} AND id::text=${literal(object.id)};`));
    if (count !== 1) throw new Error("Storage-Datei und Datenbankmetadaten passen nicht zusammen.");
    await copyFile(path.join(destination, "objects", object.file), path.join(restoredFiles, object.file));
  }
  await writeFile(path.join(destination, "restore-proof.json"), JSON.stringify({ verifiedAt: new Date().toISOString(), databaseRestored: true, network: "none", tablesCompared: manifest.tables.length, policiesCompared: policies.length, catalogCompared: true, filesCompared: storage.objects.length, applicationFlowsVerified: false }), { mode: 0o600 });
  console.log("Isolierter Datenbank-Restore, RLS und Storage-Dateiprüfung erfolgreich. Keine App-Anmeldung oder Storage-API geprüft.");
} catch {
  console.error("Isolierter Restore fehlgeschlagen. Keine privaten Diagnosedaten veröffentlicht.");
  process.exitCode = 1;
} finally {
  spawnSync("docker", ["rm", "--force", "--volumes", name], { stdio: "ignore", timeout: 30_000 });
  await log.close();
}
}
await main().catch(() => { console.error("Isolierter Restore konnte nicht vorbereitet werden. Keine privaten Diagnosedaten veröffentlicht."); process.exitCode = 1; });
