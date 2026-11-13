import { spawn } from "node:child_process";
import { open, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import path from "node:path";
import { CATALOG_SQL } from "./backup-contract.mjs";

const quote = (value) => `"${value.replaceAll('"', '""')}"`;
async function main() {
const destination = process.argv[2];
if (!destination) {
  console.error("Datenbankexport fehlgeschlagen. Phase: INITIALISIERUNG; Klasse: KONFIGURATION.");
  process.exit(1);
}
const log = await open(path.join(destination, "database-private.log"), "w", 0o600);
const session = spawn("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"], { stdio: ["pipe", "pipe", log.fd] });
const lines = createInterface({ input: session.stdout })[Symbol.asyncIterator]();
const completed = new Promise((resolve) => session.on("close", resolve));
const spawnFailed = new Promise((resolve) => session.on("error", () => resolve({ done: true })));
session.stdin.on("error", () => {});
async function query(sql) {
  // json_agg zusammengesetzter Zeilen enthält Formatierungsumbrüche. jsonb::text
  // hält das Protokoll auch bei mehreren Katalogeinträgen auf genau einer Zeile.
  const select = sql.trim().replace(/;$/, "");
  session.stdin.write(`SELECT to_jsonb(value)::text FROM (${select}) AS result(value);\n`);
  const line = await Promise.race([lines.next(), spawnFailed]);
  if (line.done) throw new Error("Datenbankabfrage fehlgeschlagen.");
  return JSON.parse(line.value);
}
let stage = "SNAPSHOT";
let contractFailure = false;
function requireContract(condition) {
  if (!condition) {
    contractFailure = true;
    throw new Error();
  }
}
// Nur feste Klassen ausgeben. Insbesondere darf niemals ein Teil des Logs ausgegeben werden.
function classify(logText) {
  const state = /(?:ERROR|FATAL|PANIC):\s+([0-9A-Z]{5}):/.exec(logText)?.[1];
  if (state && ["28P01", "28000"].includes(state)) return "AUTH";
  if (state && ["42501", "42502"].includes(state)) return "BERECHTIGUNG";
  if (state && ["22023", "55000"].includes(state) && stage === "SNAPSHOT") return "SNAPSHOT";
  if (/password authentication failed|no password supplied|no pg_hba\.conf entry|authentication failed/i.test(logText)) return "AUTH";
  if (/server certificate for .* does not match host name|server certificate does not match host name|certificate subject name .* does not match/i.test(logText)) return "TLS_HOSTNAME";
  if (/certificate verify failed|certificate verification failed|self.signed certificate|unable to get (?:local )?issuer certificate|could not load (?:system )?root certificate|root certificate file .* does not exist/i.test(logText)) return "TLS_ZERTIFIKAT";
  if (/SSL connection (?:has been closed unexpectedly|has been closed|was closed)|SSL SYSCALL/i.test(logText)) return "TLS_VERBINDUNG";
  if (/SSL error|SSL connection|TLS error/i.test(logText)) return "TLS_SONSTIG";
  if (/could not translate host name|name or service not known|temporary failure in name resolution|getaddrinfo/i.test(logText)) return "DNS";
  if (/permission denied|must be (?:owner|superuser)/i.test(logText)) return "BERECHTIGUNG";
  if (/invalid snapshot identifier|could not import the requested snapshot/i.test(logText)) return "SNAPSHOT";
  return "UNBEKANNT";
}
try {
  session.stdin.write("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n");
  const snapshot = await query("SELECT to_json(pg_export_snapshot());");
  requireContract(typeof snapshot === "string" && /^[0-9A-F-]+$/i.test(snapshot));
  stage = "MANIFEST_VERSION";
  const version = await query("SELECT to_json(current_setting('server_version'));");
  requireContract(typeof version === "string" && /^17\./.test(version));
  stage = "MANIFEST_TABELLEN";
  const tables = await query("SELECT coalesce(json_agg(json_build_object('schema',n.nspname,'table',c.relname,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity) ORDER BY n.nspname,c.relname),'[]'::json) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%';");
  for (const table of tables) table.rows = await query(`SELECT to_json(count(*)) FROM ${quote(table.schema)}.${quote(table.table)};`);
  stage = "MANIFEST_POLICIES";
  const policies = await query("SELECT coalesce(json_agg(p ORDER BY schemaname,tablename,policyname),'[]'::json) FROM pg_policies p WHERE schemaname NOT LIKE 'pg_%';");
  stage = "MANIFEST_ROLLEN";
  const roles = await query("SELECT coalesce(json_agg(json_build_object('name',rolname,'superuser',rolsuper,'inherit',rolinherit,'createRole',rolcreaterole,'createDb',rolcreatedb,'replication',rolreplication,'bypassRls',rolbypassrls) ORDER BY rolname),'[]'::json) FROM pg_roles WHERE rolname NOT LIKE 'pg_%';");
  stage = "MANIFEST_MITGLIEDSCHAFTEN";
  const memberships = await query("SELECT coalesce(json_agg(json_build_object('role',r.rolname,'member',m.rolname,'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option) ORDER BY r.rolname,m.rolname),'[]'::json) FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member;");
  // Vault-Schlüssel sind kein Bestandteil eines Dumps. Ohne separaten Vertrag nicht fortfahren.
  stage = "MANIFEST_VAULT";
  const vaultSecrets = await query("SELECT to_json(count(*)) FROM vault.secrets;");
  requireContract(vaultSecrets === 0);
  stage = "MANIFEST_IMAGE";
  requireContract(/^supabase\/postgres@sha256:[a-f0-9]{64}$/.test(process.env.BACKUP_POSTGRES_IMAGE ?? ""));
  stage = "MANIFEST_KATALOG";
  const catalog = await query(CATALOG_SQL);
  const manifest = { schemaVersion: 2, createdAt: new Date().toISOString(), projectRef: process.env.BACKUP_PROJECT_REF, serverVersion: version, postgresImage: process.env.BACKUP_POSTGRES_IMAGE, tables, policies, roles, memberships, vaultSecrets, catalog };
  stage = "MANIFEST_SCHREIBEN";
  await writeFile(path.join(destination, "backup.json"), JSON.stringify(manifest), { mode: 0o600 });
  stage = "DUMP";
  const dump = spawn("pg_dump", ["--format=custom", `--snapshot=${snapshot}`, `--file=${path.join(destination, "database.dump")}`], { stdio: ["ignore", "ignore", log.fd] });
  const code = await new Promise((resolve, reject) => { dump.on("close", resolve); dump.on("error", reject); });
  if (code !== 0) throw new Error("Datenbankexport fehlgeschlagen.");
  stage = "ABSCHLUSS";
  session.stdin.end("ROLLBACK;\n");
  if (await completed !== 0) throw new Error("Datenbanksitzung fehlgeschlagen.");
} catch {
  session.stdin.destroy();
  session.kill();
  await completed;
  let errorClass = contractFailure ? "VERTRAG" : "UNBEKANNT";
  if (!contractFailure) {
    try { errorClass = classify(await readFile(path.join(destination, "database-private.log"), "utf8")); } catch { /* Kein privater Loginhalt verfügbar. */ }
  }
  console.error(`Datenbankexport fehlgeschlagen. Phase: ${stage}; Klasse: ${errorClass}. Private Diagnosedaten werden nicht veröffentlicht.`);
  process.exitCode = 1;
} finally {
  await log.close();
}

}
main().catch(() => {
  console.error("Datenbankexport fehlgeschlagen. Phase: INITIALISIERUNG; Klasse: UNBEKANNT. Private Diagnosedaten werden nicht veröffentlicht.");
  process.exitCode = 1;
});
