import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Nur innerhalb des Testnetzes erreichbar. Die URL kann nicht durch das Backup
// oder eine Umgebungsvariable auf ein fremdes Ziel umgestellt werden.
const ORIGIN = "https://127.0.0.1:8000";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function pruefeStorageDateien(storage, objectDirectory, serviceKey, request = fetch) {
  if (!Array.isArray(storage?.objects) || !serviceKey) throw new Error("Ungültiger Storage-Vertrag.");
  for (const object of storage.objects) {
    if (!/^[a-f0-9]{64}$/.test(object.file) || !/^[a-f0-9]{64}$/.test(object.sha256) ||
        !Number.isSafeInteger(object.bytes) || object.bytes < 0 ||
        typeof object.bucket !== "string" || !object.bucket || typeof object.name !== "string" || !object.name ||
        object.name.split("/").some((part) => !part || part === "." || part === "..")) {
      throw new Error("Ungültiger Storage-Objektvertrag.");
    }
    const bytes = await readFile(path.join(objectDirectory, object.file));
    if (bytes.length !== object.bytes || digest(bytes) !== object.sha256) throw new Error("Storage-Datei weicht ab.");
    const mime = object.metadata?.mimetype;
    if (typeof mime !== "string" || !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(mime)) throw new Error("Storage-Medientyp fehlt oder ist ungültig.");
    const encodedName = object.name.split("/").map(encodeURIComponent).join("/");
    const url = `${ORIGIN}/storage/v1/object/${encodeURIComponent(object.bucket)}/${encodedName}`;
    const headers = { authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
    const write = await request(url, { method: "POST", headers: { ...headers, "content-type": mime, "x-upsert": "true" }, body: bytes, redirect: "error" });
    if (!write.ok) throw new Error("Lokaler Storage-Import fehlgeschlagen.");
    const read = await request(url, { method: "GET", headers, redirect: "error" });
    if (!read.ok) throw new Error("Lokaler Storage-Abruf fehlgeschlagen.");
    const restored = Buffer.from(await read.arrayBuffer());
    if (restored.length !== object.bytes || digest(restored) !== object.sha256) throw new Error("Lokaler Storage-Inhalt weicht ab.");
  }
  return storage.objects.length;
}
