import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { inventory, download } from "./backup-storage.mjs";

const entry = (name, id = name) => ({ name, id, updated_at: "2026-01-01T00:00:00Z", metadata: { size: 1, eTag: "v1" } });
function fake() {
  const root = Array.from({ length: 101 }, (_, i) => entry(`file-${String(i).padStart(3, "0")}`));
  root.push({ name: "folder", id: null });
  const state = { root, nested: [entry("child")], bucket: { id: "test", name: "test", public: false }, calls: [], altered: false };
  return { state, storage: {
    async listBuckets() { return { data: [state.bucket], error: null }; },
    from() { return {
      async list(prefix, { offset, limit }) { state.calls.push([prefix, offset]); return { data: (prefix ? state.nested : state.root).slice(offset, offset + limit), error: null }; },
      async download() { return { data: new Blob([state.altered ? "changed" : "x"]), error: null }; },
    }; },
  } };
}
async function withDir(fn) { const dir = await mkdtemp(path.join(tmpdir(), "fcb-storage-test-")); try { await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); } }

test("Seiten und Unterordner werden erfasst; Dateinamen sind Hashes", async () => withDir(async (dir) => {
  const client = fake();
  const before = await inventory(client);
  assert.equal(before.objects.length, 102);
  assert(client.state.calls.some(([prefix, offset]) => prefix === "" && offset === 100));
  assert(before.objects.some((o) => o.name === "folder/child"));
  await download(client, dir, before);
  const files = await readdir(path.join(dir, "objects"));
  assert.equal(files.length, 102);
  assert(files.every((name) => /^[a-f0-9]{64}$/.test(name)));
  assert.equal(JSON.parse(await readFile(path.join(dir, "storage.json"))).objects.length, 102);
}));

test("neue, entfernte, geänderte Objekte und Bucketänderungen stoppen den Export", async () => {
  for (const mutate of [s => s.root.push(entry("new")), s => s.root.pop(), s => { s.root[0].updated_at = "changed"; }, s => { s.bucket.public = true; }]) {
    await withDir(async (dir) => { const client = fake(); const before = await inventory(client); mutate(client.state); await assert.rejects(download(client, dir, before), /verändert/); });
  }
});

test("abweichende Größe und unsichere Pfade werden abgewiesen", async () => withDir(async (dir) => {
  const client = fake(); const before = await inventory(client); client.state.altered = true;
  await assert.rejects(download(client, dir, before), /Größe/);
  client.state.root = [entry("..")];
  await assert.rejects(inventory(client), /Pfad/);
}));

test("Fehler aus dem Client werden nicht ausgegeben", async () => {
  const client = fake(); client.storage.listBuckets = async () => ({ data: null, error: { message: "privates-token" } });
  await assert.rejects(inventory(client), (error) => !error.message.includes("privates-token"));
});
