import { readFile } from "node:fs/promises";

export function validateServiceRoleKey(value) {
  if (typeof value !== "string" || value.length < 32 || !/^[A-Za-z0-9_.-]+$/.test(value)) throw new Error("Ungültiges Schlüsselformat.");
  if (!value.startsWith("sb_secret_")) {
    const payload = JSON.parse(Buffer.from(value.split(".")[1] ?? "", "base64url").toString("utf8"));
    if (payload.role !== "service_role" || payload.ref !== "jktvmckqfklfziszfsxf") throw new Error("Storage-Schlüssel gehört nicht zum bestätigten Projekt.");
  }
  return value;
}

/** Liest genau einen benannten Wert. Keine Shell-Auswertung oder Variablenersetzung. */
export async function readServiceRoleKey(filename) {
  const contents = await readFile(filename, "utf8");
  const matches = contents.split(/\r?\n/).map((line) => line.match(/^\s*(?:export\s+)?SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*?)\s*$/)).filter(Boolean);
  if (matches.length !== 1) throw new Error("Lokaler Storage-Schlüssel ist nicht eindeutig.");
  let value = matches[0][1];
  if (value.startsWith('"')) value = JSON.parse(value);
  else if (value.startsWith("'")) {
    if (!value.endsWith("'")) throw new Error("Ungültiges Schlüsselformat.");
    value = value.slice(1, -1);
  } else value = value.replace(/\s+#.*$/, "");
  return validateServiceRoleKey(value);
}
