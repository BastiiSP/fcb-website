import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./restore-isolated.mjs", import.meta.url));
const secret = "PRIVATE_DIAGNOSE_NICHT_AUSGEBEN";
const fakeDocker = `#!/usr/bin/env node
const args = process.argv.slice(2);
const fs = require('node:fs');
if (args[0] === 'rm') process.exit(0);
if (args[0] === 'run') {
  if (process.env.FAIL === 'CONTAINER') { console.error('ERROR: 42710: ${secret}'); process.exit(1); }
  console.log('container'); process.exit(0);
}
if (args[0] === 'inspect') { console.log('none'); process.exit(0); }
if (args.includes('-h')) { console.log('1'); process.exit(0); }
if (args.includes('pg_restore')) {
  if (process.env.FAIL === 'PG_RESTORE') { console.error('permission denied ${secret}'); process.exit(1); }
  process.exit(0);
}
const input = fs.readFileSync(0, 'utf8');
if (!input.startsWith('SET search_path = public, extensions;\\n')) process.exit(1);
if (input.includes('CREATE ROLE') && process.env.FAIL === 'ROLLEN') {
  console.error('ERROR: 42501: ${secret}'); process.exit(1);
}
if (input.includes('GRANT ') && process.env.FAIL === 'MITGLIEDSCHAFTEN') {
  console.error('ERROR: 42710: ${secret}'); process.exit(1);
}
if (input.includes('count(*) FROM')) { console.log(JSON.stringify({ rows: process.env.FAIL === 'TABELLEN' ? 2 : 1, rls: true, forceRls: false })); }
else if (input.includes('pg_policies')) {
  const policies = [{ schemaname: 'public', tablename: 'PRIVATE_DIAGNOSE_NICHT_AUSGEBEN', policyname: 'test', permissive: 'PERMISSIVE', roles: process.env.FAIL === 'POLICIES' ? ['z', 'a'] : ['a', 'z'], cmd: 'SELECT', qual: 'true', with_check: null }, { schemaname: 'public', tablename: 'andere', policyname: 'test', permissive: 'PERMISSIVE', roles: ['public'], cmd: 'SELECT', qual: 'true', with_check: null }];
  console.log(JSON.stringify(process.env.FAIL === 'POLICY_ORDER' ? policies.reverse() : policies));
}
else if (input.includes('json_build_object')) console.log('{}');
`;

async function run(failure, metadataSearchPath = ["public", "extensions"], projectRef = "anderesprojekt", applicationRestore = "false") {
  const dir = await mkdtemp(path.join(os.tmpdir(), "restore-diagnostics-"));
  try {
    const bin = path.join(dir, "bin");
    const payload = path.join(dir, "payload");
    await mkdir(bin); await mkdir(payload);
    await writeFile(path.join(bin, "docker"), fakeDocker, { mode: 0o755 });
    await writeFile(path.join(payload, "backup.json"), JSON.stringify({ schemaVersion: 2, metadataSearchPath: metadataSearchPath === null ? undefined : metadataSearchPath, projectRef, serverVersion: "17.6", vaultSecrets: 0, postgresImage: `supabase/postgres@sha256:${"a".repeat(64)}`, roles: [{ name: "beispiel" }], memberships: [{ role: "a", member: "b" }], tables: [{ schema: "public", table: "beispiel", rows: 1, rls: true, forceRls: false }], policies: [{ schemaname: "public", tablename: secret, policyname: "test", permissive: "PERMISSIVE", roles: ["a", "z"], cmd: "SELECT", qual: "true", with_check: null }, { schemaname: "public", tablename: "andere", policyname: "test", permissive: "PERMISSIVE", roles: ["public"], cmd: "SELECT", qual: "true", with_check: null }], catalog: {} }));
    await writeFile(path.join(payload, "storage.json"), JSON.stringify({ objects: [] }));
    return spawnSync(process.execPath, [script, payload], { encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAIL: failure, BACKUP_APPLICATION_RESTORE: applicationRestore, RESTORE_APP_PREPARED_FILE: "" } });
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test("Restore meldet feste Phasen und Klassen ohne private Fehlermeldungen", async () => {
  for (const [phase, expected] of [["CONTAINER", "DUPLIKAT"], ["ROLLEN", "BERECHTIGUNG"], ["MITGLIEDSCHAFTEN", "DUPLIKAT"], ["PG_RESTORE", "BERECHTIGUNG"], ["TABELLEN", "VERTRAG"]]) {
    const result = await run(phase);
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`Phase: ${phase}; Klasse: ${expected}\\.`));
    assert.doesNotMatch(result.stderr + result.stdout, new RegExp(secret));
  }
});

test("Erfolgreicher simulierter Restore erhält alle Prüfverträge", async () => {
  const result = await run("");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Restore, RLS und Storage-Dateiprüfung erfolgreich/);
});

test("Policy-Diagnose erkennt reine Rollenreihenfolge ohne Inhalte", async () => {
  const result = await run("POLICIES");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /roles=1; roles_nur_Reihenfolge=1; cmd=0; qual=0; with_check=0/);
  assert.match(result.stderr, /Phase: POLICIES; Klasse: VERTRAG/);
  assert.match(result.stderr, /Katalog-Differenz:/);
  assert.doesNotMatch(result.stderr + result.stdout, new RegExp(secret));
});

test("Policy-Diagnose erkennt ausschließlich vertauschte vollständige Zeilen", async () => {
  const result = await run("POLICY_ORDER");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /policies_nur_Reihenfolge=true/);
  assert.match(result.stderr, /Phase: POLICIES; Klasse: VERTRAG/);
  assert.doesNotMatch(result.stderr + result.stdout, new RegExp(secret));
});

test("Restore akzeptiert nur den festgelegten oder belegten früheren Metadatenkontext", async () => {
  assert.equal((await run("", ["public", "extensions"])).status, 0);
  const invalid = await run("", ["public", "auth", "extensions"]);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Phase: CONTAINER; Klasse: VERTRAG/);
  assert.equal((await run("", null, "jktvmckqfklfziszfsxf")).status, 0);
  assert.equal((await run("", null, "anderesprojekt")).status, 1);
});


test("Anwendungsprobe benötigt explizite private Vorbereitung und bleibt sonst aus", async () => {
  const result = await run("", ["public", "extensions"], "anderesprojekt", "true");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Phase: APP_VORBEREITUNG; Klasse: VERTRAG/);
  assert.doesNotMatch(result.stdout, /Restore, RLS und Storage-Dateiprüfung erfolgreich/);
  assert.doesNotMatch(result.stderr + result.stdout, new RegExp(secret));
  assert.equal((await run("", ["public", "extensions"], "anderesprojekt", "ungueltig")).status, 1);
});
