import { readFile } from "node:fs/promises";
import { synthetischeKontenErstellen } from "./restore-app-accounts.mjs";
import { pruefeRollen } from "./restore-app-roles.mjs";
import { pruefeStorageDateien } from "./restore-app-storage.mjs";
import { pruefeBrowser } from "./restore-app-browser.mjs";

// Dieser Prozess läuft ausschließlich im geprüften netzlosen Namespace. Seine
// Ausgabe enthält keine Konten, Objektpfade oder Daten aus der Sicherung.
let phase = "STORAGE";
try {
  const storage = JSON.parse(await readFile("/payload/storage.json", "utf8"));
  const { RESTORE_SERVICE_KEY: service, RESTORE_ANON_KEY: anon, RESTORE_TLS_SPKI: spki } = process.env;
  const count = await pruefeStorageDateien(storage, "/payload/objects", service);
  const avatar = storage.objects.find((object) => object.bucket === "avatars" && object.bytes > 0);
  if (!avatar || count !== storage.objects.length) throw new Error("Avatarvertrag fehlt.");
  phase = "AUTH";
  const accounts = await synthetischeKontenErstellen(service, anon);
  phase = "ROLLEN";
  await pruefeRollen(accounts, service, anon);
  const browserAccounts = accounts.filter((entry) => (entry.rolle === "ausstehend" && entry.tenant === "fcb") ||
    (entry.rolle === "mitglied" && entry.tenant === "jfg"));
  phase = "BROWSER";
  const browsers = await pruefeBrowser(browserAccounts, spki, avatar);
  if (browsers !== 2) throw new Error("Browservertrag nicht erfüllt.");
  process.stdout.write(`Anwendungsprobe erfolgreich: ${count} Storage-Dateien, 7 Auth-Konten, 2 Browserfälle.\n`);
} catch {
  process.stderr.write(`ANWENDUNGSPHASE:${phase}\n`);
  process.exitCode = 1;
}
