import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const ordered = (value) => Array.isArray(value) ? value.map(ordered) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, ordered(value[key])])) : value;
const canonical = (value) => JSON.stringify(ordered(value));

export async function inventory(client) {
  const { data, error } = await client.storage.listBuckets();
  if (error || !Array.isArray(data)) throw new Error("Storage-Buckets konnten nicht gelesen werden.");
  const buckets = data.map((b) => ({ id: b.id, name: b.name, public: b.public, file_size_limit: b.file_size_limit ?? null, allowed_mime_types: b.allowed_mime_types ?? null }));
  const objects = [];
  async function collect(bucket, prefix = "") {
    for (let offset = 0; ; offset += 100) {
      const { data: entries, error: listError } = await client.storage.from(bucket).list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
      if (listError || !Array.isArray(entries)) throw new Error("Storage-Inventur fehlgeschlagen.");
      for (const entry of entries) {
        if (typeof entry.name !== "string" || !entry.name || entry.name === "." || entry.name === ".." || entry.name.includes("/")) throw new Error("Ungültiger Storage-Pfad.");
        const name = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id === null) {
          await collect(bucket, name);
        } else {
          if (typeof entry.id !== "string" || typeof entry.updated_at !== "string" || !Number.isSafeInteger(entry.metadata?.size) || entry.metadata.size < 0) throw new Error("Storage-Metadaten sind unvollständig.");
          objects.push({ bucket, name, id: entry.id, updated_at: entry.updated_at, metadata: entry.metadata, version: entry.version ?? null });
        }
      }
      if (entries.length < 100) break;
    }
  }
  for (const bucket of buckets) {
    if (typeof bucket.id !== "string" || typeof bucket.name !== "string" || typeof bucket.public !== "boolean") throw new Error("Bucket-Metadaten sind unvollständig.");
    await collect(bucket.id);
  }
  buckets.sort((a, b) => a.id.localeCompare(b.id));
  objects.sort((a, b) => canonical([a.bucket, a.name]).localeCompare(canonical([b.bucket, b.name])));
  if (new Set(objects.map((o) => canonical([o.bucket, o.name]))).size !== objects.length) throw new Error("Storage-Inventur enthält doppelte Objekte.");
  return { buckets, objects };
}

export async function download(client, destination, before) {
  await mkdir(path.join(destination, "objects"), { recursive: true, mode: 0o700 });
  const objects = [];
  for (const item of before.objects) {
    const { data, error } = await client.storage.from(item.bucket).download(item.name);
    if (error || !data) throw new Error("Ein Storage-Objekt konnte nicht gesichert werden.");
    const bytes = Buffer.from(await data.arrayBuffer());
    if (bytes.length !== item.metadata.size) throw new Error("Storage-Objekt hat eine abweichende Größe.");
    const file = digest(JSON.stringify([item.bucket, item.name]));
    await writeFile(path.join(destination, "objects", file), bytes, { mode: 0o600, flag: "wx" });
    objects.push({ ...item, file, sha256: digest(bytes), bytes: bytes.length });
  }
  const after = await inventory(client);
  if (canonical(before) !== canonical(after)) throw new Error("Storage wurde während der Sicherung verändert.");
  await writeFile(path.join(destination, "storage.json"), JSON.stringify({ buckets: before.buckets, objects }, null, 2), { mode: 0o600 });
}

async function main() {
  const [phase, destination] = process.argv.slice(2);
  if (!["inventory", "download"].includes(phase) || !destination || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Storage-Ziel und Supabase-Zugang fehlen.");
  if (new URL(process.env.SUPABASE_URL).protocol !== "https:") throw new Error("Storage benötigt eine HTTPS-Verbindung.");
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const inventoryPath = path.join(destination, "inventory.json");
  if (phase === "inventory") {
    await writeFile(inventoryPath, JSON.stringify(await inventory(client)), { mode: 0o600 });
  } else {
    await download(client, destination, JSON.parse(await readFile(inventoryPath, "utf8")));
    console.log("Storage-Export und Inventurabgleich abgeschlossen.");
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { await main(); } catch { console.error("Storage-Sicherung fehlgeschlagen; keine Sicherung erstellt."); process.exitCode = 1; }
}
