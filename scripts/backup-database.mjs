import { spawn } from "node:child_process";
import { open, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import path from "node:path";
import { CATALOG_SQL } from "./backup-contract.mjs";

const quote = (value) => `"${value.replaceAll('"', '""')}"`;
const destination = process.argv[2];
if (!destination) throw new Error("Privates Sicherungsziel fehlt.");
const log = await open(path.join(destination, "database-private.log"), "w", 0o600);
const session = spawn("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1"], { stdio: ["pipe", "pipe", log.fd] });
const lines = createInterface({ input: session.stdout })[Symbol.asyncIterator]();
const completed = new Promise((resolve) => session.on("close", resolve));
session.on("error", () => session.stdout.destroy());
async function query(sql) {
  // json_agg zusammengesetzter Zeilen enthält Formatierungsumbrüche. jsonb::text
  // hält das Protokoll auch bei mehreren Katalogeinträgen auf genau einer Zeile.
  const select = sql.trim().replace(/;$/, "");
  session.stdin.write(`SELECT to_jsonb(value)::text FROM (${select}) AS result(value);\n`);
  const line = await lines.next();
  if (line.done) throw new Error("Datenbankabfrage fehlgeschlagen.");
  return JSON.parse(line.value);
}
try {
  session.stdin.write("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n");
  const snapshot = await query("SELECT to_json(pg_export_snapshot());");
  if (!/^[0-9A-F-]+$/i.test(snapshot)) throw new Error("Ungültiger Datenbank-Snapshot.");
  const version = await query("SELECT to_json(current_setting('server_version'));");
  if (!/^17\./.test(version)) throw new Error("Die Wiederherstellungsprüfung erwartet PostgreSQL 17.");
  const tables = await query("SELECT coalesce(json_agg(json_build_object('schema',n.nspname,'table',c.relname,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity) ORDER BY n.nspname,c.relname),'[]'::json) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%';");
  for (const table of tables) table.rows = await query(`SELECT to_json(count(*)) FROM ${quote(table.schema)}.${quote(table.table)};`);
  const policies = await query("SELECT coalesce(json_agg(p ORDER BY schemaname,tablename,policyname),'[]'::json) FROM pg_policies p WHERE schemaname NOT LIKE 'pg_%';");
  const roles = await query("SELECT coalesce(json_agg(json_build_object('name',rolname,'superuser',rolsuper,'inherit',rolinherit,'createRole',rolcreaterole,'createDb',rolcreatedb,'replication',rolreplication,'bypassRls',rolbypassrls) ORDER BY rolname),'[]'::json) FROM pg_roles WHERE rolname NOT LIKE 'pg_%';");
  const memberships = await query("SELECT coalesce(json_agg(json_build_object('role',r.rolname,'member',m.rolname,'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option) ORDER BY r.rolname,m.rolname),'[]'::json) FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member;");
  // Vault-Schlüssel sind kein Bestandteil eines Dumps. Ohne separaten Vertrag nicht fortfahren.
  const vaultSecrets = await query("SELECT to_json(count(*)) FROM vault.secrets;");
  if (vaultSecrets !== 0) throw new Error("Vault benötigt einen gesonderten Wiederherstellungsvertrag.");
  if (!/^supabase\/postgres@sha256:[a-f0-9]{64}$/.test(process.env.BACKUP_POSTGRES_IMAGE ?? "")) throw new Error("Unveränderliche PostgreSQL-Imagekennung fehlt.");
  const catalog = await query(CATALOG_SQL);
  const manifest = { schemaVersion: 2, createdAt: new Date().toISOString(), projectRef: process.env.BACKUP_PROJECT_REF, serverVersion: version, postgresImage: process.env.BACKUP_POSTGRES_IMAGE, tables, policies, roles, memberships, vaultSecrets, catalog };
  await writeFile(path.join(destination, "backup.json"), JSON.stringify(manifest), { mode: 0o600 });
  const dump = spawn("pg_dump", ["--format=custom", `--snapshot=${snapshot}`, `--file=${path.join(destination, "database.dump")}`], { stdio: ["ignore", "ignore", log.fd] });
  const code = await new Promise((resolve, reject) => { dump.on("close", resolve); dump.on("error", reject); });
  if (code !== 0) throw new Error("Datenbankexport fehlgeschlagen.");
  session.stdin.end("ROLLBACK;\n");
  if (await completed !== 0) throw new Error("Datenbanksitzung fehlgeschlagen.");
} catch {
  session.stdin.destroy();
  session.kill();
  console.error("Datenbankexport fehlgeschlagen. Private Diagnosedaten werden nicht veröffentlicht.");
  process.exitCode = 1;
} finally {
  await log.close();
}
