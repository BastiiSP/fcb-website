import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readServiceRoleKey } from "./backup-env.mjs";

test("lokaler Schlüssel wird gezielt ohne Auswertung anderer Variablen gelesen", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "backup-env-"));
  const filename = path.join(directory, "fixture");
  const token = `fixture.${Buffer.from(JSON.stringify({ role: "service_role", ref: "jktvmckqfklfziszfsxf" })).toString("base64url")}.fixture`;
  try {
    await writeFile(filename, `OTHER=$(ungueltiger-befehl)\nSUPABASE_SERVICE_ROLE_KEY='${token}'\n`);
    assert.equal(await readServiceRoleKey(filename), token);
    await writeFile(filename, `SUPABASE_SERVICE_ROLE_KEY=${token}\nSUPABASE_SERVICE_ROLE_KEY=${token}\n`);
    await assert.rejects(readServiceRoleKey(filename));
    await writeFile(filename, 'SUPABASE_SERVICE_ROLE_KEY=$(ungueltiger-befehl)\n');
    await assert.rejects(readServiceRoleKey(filename));
    const wrong = `fixture.${Buffer.from(JSON.stringify({ role: "anon", ref: "jktvmckqfklfziszfsxf" })).toString("base64url")}.fixture`;
    await writeFile(filename, `SUPABASE_SERVICE_ROLE_KEY=${wrong}\n`);
    await assert.rejects(readServiceRoleKey(filename));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
