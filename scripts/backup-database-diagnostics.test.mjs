import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./backup-database.mjs", import.meta.url));
const secret = "secret-user-host-password-SQL-person-data";
const fakePsql = `#!/usr/bin/env node
let n = 0;
let searchPathSet = false;
process.stdin.setEncoding('utf8');
let buf = '';
process.stdin.on('data', chunk => {
  buf += chunk;
  for (;;) {
    const end = buf.indexOf('\\n');
    if (end < 0) break;
    const line = buf.slice(0, end); buf = buf.slice(end + 1);
    if (line === 'SET LOCAL search_path = public, extensions;') searchPathSet = true;
    if (!line.startsWith('SELECT to_jsonb')) continue;
    if (!searchPathSet) process.exit(1);
    n++;
    if (process.env.FAIL_AT === String(n)) {
      process.stderr.write(process.env.PRIVATE_ERROR + '\\n');
      process.exit(1);
    }
    const values = ['"00000003-0000001A-1"', '"17.6"', '[]', '[]', '[]', '[]', '0', '{}'];
    if (process.env.BAD_VERSION && n === 2) process.stdout.write('"16"\\n');
    else process.stdout.write(values[n - 1] + '\\n');
  }
});
`;
const fakeDump = `#!/usr/bin/env node
if (process.env.DUMP_FAIL) { process.stderr.write(process.env.PRIVATE_ERROR); process.exit(1); }
`;

async function run(options = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "backup-diagnostics-"));
  try {
    const bin = path.join(dir, "bin"), payload = path.join(dir, "payload");
    await mkdir(bin); await mkdir(payload);
    await writeFile(path.join(bin, "psql"), fakePsql, { mode: 0o700 });
    await writeFile(path.join(bin, "pg_dump"), fakeDump, { mode: 0o700 });
    const result = spawnSync(process.execPath, [script, payload], {
      env: { PATH: `${bin}:${process.env.PATH}`, BACKUP_POSTGRES_IMAGE: `supabase/postgres@sha256:${"a".repeat(64)}`, ...options },
      encoding: "utf8", timeout: 5000,
    });
    assert.equal(result.status, 1, result.error?.message);
    assert.doesNotMatch(result.stdout + result.stderr, new RegExp(secret));
    assert.equal(result.stdout, "");
    return result.stderr;
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test("Fehlerklassen enthalten keine privaten Fehlermeldungen", async () => {
  const cases = [
    ["FATAL: 28P01: password authentication failed", "AUTH"],
    ["FATAL: certificate verify failed", "TLS_ZERTIFIKAT"],
    ["server certificate for private.example does not match host name private.host", "TLS_HOSTNAME"],
    ["SSL connection has been closed unexpectedly", "TLS_VERBINDUNG"],
    ["SSL error: unspecified", "TLS_SONSTIG"],
    ["could not translate host name", "DNS"],
    ["ERROR: 42501: permission denied", "BERECHTIGUNG"],
    ["ERROR: 55000: invalid snapshot identifier", "SNAPSHOT"],
    ["unbekannter Fehler", "UNBEKANNT"],
  ];
  for (const [error, expected] of cases) {
    const output = await run({ FAIL_AT: "1", PRIVATE_ERROR: `${error} ${secret}` });
    assert.match(output, new RegExp(`Phase: SNAPSHOT; Klasse: ${expected}\\.`));
    assert.doesNotMatch(output, /FATAL|ERROR|password authentication|permission denied|private\.example|private\.host/);
  }
});

test("Manifestvertrag und Dump melden ausschließlich feste Phasen und Klassen", async () => {
  assert.match(await run({ BAD_VERSION: "1", PRIVATE_ERROR: secret }), /Phase: MANIFEST_VERSION; Klasse: VERTRAG\./);
  assert.match(await run({ FAIL_AT: "7", PRIVATE_ERROR: `ERROR: 42501: permission denied ${secret}` }), /Phase: MANIFEST_VAULT; Klasse: BERECHTIGUNG\./);
  assert.match(await run({ DUMP_FAIL: "1", PRIVATE_ERROR: `invalid snapshot identifier ${secret}` }), /Phase: DUMP; Klasse: SNAPSHOT\./);
});


test("Fehlendes psql beendet den Export mit sicherer Diagnose", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "backup-no-psql-"));
  try {
    const result = spawnSync(process.execPath, [script, dir], {
      env: { PATH: "/nonexistent" }, encoding: "utf8", timeout: 5000,
    });
    assert.equal(result.status, 1, result.error?.message);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /^Datenbankexport fehlgeschlagen\. Phase: SNAPSHOT; Klasse: UNBEKANNT\./);
    assert.doesNotMatch(result.stderr, /ENOENT|spawn|\/nonexistent/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
