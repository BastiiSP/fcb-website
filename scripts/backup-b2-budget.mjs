import { spawnSync } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export const LIMIT_BYTES = 8_000_000_000;
const MAX_PAYLOAD_BYTES = 100_000_000;
export function assertBudget(stored, payload) {
  if (!Number.isSafeInteger(stored) || stored < 0 || !Number.isSafeInteger(payload) || payload < 0 || payload > MAX_PAYLOAD_BYTES || stored + payload * 3 + 128_000_000 > LIMIT_BYTES) throw new Error("Kostenloses Sicherungsbudget überschritten.");
}
async function size(directory) {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = path.join(directory, entry.name);
    if (entry.isDirectory()) bytes += await size(name);
    else if (entry.isFile()) bytes += (await stat(name)).size;
    else throw new Error("Unerwarteter Dateityp im Sicherungsziel.");
  }
  return bytes;
}
function aws(command) {
  const result = spawnSync("aws", ["s3api", ...command, "--endpoint-url", process.env.BACKUP_S3_ENDPOINT, "--output", "json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 120_000, env: { ...process.env, AWS_PAGER: "" } });
  if (result.status !== 0) throw new Error("B2-Budget konnte nicht geprüft werden.");
  return JSON.parse(result.stdout);
}
export async function checkB2Budget(directory) {
  const bucket = process.env.BACKUP_S3_BUCKET;
  if (process.env.BACKUP_FREE_TIER_CONFIRMED !== "true" || !/^https:\/\/s3\.eu-central-\d{3}\.backblazeb2\.com$/.test(process.env.BACKUP_S3_ENDPOINT ?? "") || !/^[a-z0-9][a-z0-9.-]{4,61}[a-z0-9]$/.test(bucket ?? "")) throw new Error("Kostenloses privates EU-Ziel wurde nicht bestätigt.");
  const buckets = aws(["list-buckets"]).Buckets;
  if (!Array.isArray(buckets) || buckets.length !== 1 || buckets[0].Name !== bucket) throw new Error("Das kostenlose Sicherungskonto muss ausschließlich den bestätigten Bucket enthalten.");
  const inventory = aws(["list-object-versions", "--bucket", bucket]);
  const versions = inventory.Versions ?? [];
  const deleteMarkers = inventory.DeleteMarkers ?? [];
  const uploads = aws(["list-multipart-uploads", "--bucket", bucket]).Uploads ?? [];
  if (!Array.isArray(versions) || !Array.isArray(uploads) || uploads.length) throw new Error("Unvollständige Uploads oder ungültige Inventur verhindern die Budgetprüfung.");
  if (process.env.BACKUP_REQUIRE_EMPTY === "true" && (versions.length || deleteMarkers.length)) throw new Error("Repository-Initialisierung benötigt einen vollständig leeren Bucket.");
  const stored = versions.reduce((total, version) => {
    if (!Number.isSafeInteger(version.Size) || version.Size < 0) throw new Error("Ungültige Speicherinventur.");
    return total + version.Size;
  }, 0);
  assertBudget(stored, await size(directory));
  console.log("B2-Speicherbudget einschließlich alter Objektversionen geprüft.");
}
if (process.argv[1]?.endsWith("/backup-b2-budget.mjs")) {
  try { await checkB2Budget(process.argv[2]); } catch { console.error("B2-Kosten- oder Speicherprüfung fehlgeschlagen. Kein Upload erlaubt."); process.exitCode = 1; }
}
