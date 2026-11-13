import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const destination = process.argv[2];
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!destination || !url || !key) throw new Error("Storage-Ziel und Supabase-Zugang fehlen.");
const endpoint = new URL(url);
if (endpoint.protocol !== "https:") throw new Error("Storage benötigt eine HTTPS-Verbindung.");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const objects = [];
await mkdir(path.join(destination, "objects"), { recursive: true, mode: 0o700 });
const { data: buckets, error: bucketError } = await client.storage.listBuckets();
if (bucketError || !buckets) throw new Error("Storage-Buckets konnten nicht gelesen werden.");

async function collect(bucket, prefix = "") {
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.storage.from(bucket.id).list(prefix, {
      limit: 100, offset, sortBy: { column: "name", order: "asc" },
    });
    if (error || !data) throw new Error("Storage-Objekte konnten nicht aufgelistet werden.");
    for (const entry of data) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        await collect(bucket, name);
      } else {
        const { data: blob, error: downloadError } = await client.storage.from(bucket.id).download(name);
        if (downloadError || !blob) throw new Error("Ein Storage-Objekt konnte nicht gesichert werden.");
        const bytes = Buffer.from(await blob.arrayBuffer());
        const file = createHash("sha256").update(JSON.stringify([bucket.id, name])).digest("hex");
        const sha256 = createHash("sha256").update(bytes).digest("hex");
        await writeFile(path.join(destination, "objects", file), bytes, { mode: 0o600, flag: "wx" });
        objects.push({ bucket: bucket.id, name, file, sha256, bytes: bytes.length });
      }
    }
    if (data.length < 100) break;
  }
}
for (const bucket of buckets) await collect(bucket);
await writeFile(path.join(destination, "storage.json"), JSON.stringify({ buckets, objects }, null, 2), { mode: 0o600 });
console.log(`Storage-Export abgeschlossen: ${buckets.length} Buckets, ${objects.length} Objekte.`);
