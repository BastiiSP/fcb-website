import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pruefeStorageDateien } from "./restore-app-storage.mjs";

const bytes = Buffer.from("synthetischer-storage-inhalt");
const sha256 = createHash("sha256").update(bytes).digest("hex");

test("synthetische Datei nur über festes lokales Ziel schreiben und erneut hashen", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "restore-app-storage-"));
  try {
    await writeFile(path.join(dir, sha256), bytes);
    const object = { file: sha256, sha256, bytes: bytes.length, bucket: "avatars", name: "synthetisch/avatar test.png", metadata: { mimetype: "image/png" } };
    const calls = [];
    const request = async (url, options) => {
      calls.push({ url, options });
      return new Response(options.method === "GET" ? bytes : null, { status: 200 });
    };
    assert.equal(await pruefeStorageDateien({ objects: [object] }, dir, "lokaler-testschluessel", request), 1);
    assert.deepEqual(calls.map((call) => call.options.method), ["POST", "GET"]);
    assert.ok(calls.every((call) => call.url === "https://127.0.0.1:8000/storage/v1/object/avatars/synthetisch/avatar%20test.png" && call.options.redirect === "error"));
    await assert.rejects(pruefeStorageDateien({ objects: [{ ...object, name: "../privat" }] }, dir, "lokaler-testschluessel", request));
    await assert.rejects(pruefeStorageDateien({ objects: [{ ...object, sha256: "a".repeat(64) }] }, dir, "lokaler-testschluessel", request));
    const wrongContent = async (_url, options) => new Response(options.method === "GET" ? "abweichend" : null, { status: 200 });
    await assert.rejects(pruefeStorageDateien({ objects: [object] }, dir, "lokaler-testschluessel", wrongContent));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
