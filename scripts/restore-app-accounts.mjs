import { randomBytes, randomUUID } from "node:crypto";

const ORIGIN = "https://127.0.0.1:8000";
const ROLE_MATRIX = [
  ["ausstehend", "fcb"], ["mitglied", "jfg"], ["trainer", "fcb"],
  ["trainer", "jfg"], ["vorstand", "fcb"], ["vorstand", "jfg"], ["admin", "fcb"],
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function synthetischeKontenErstellen(serviceKey, anonKey, request = fetch) {
  if (!serviceKey || !anonKey) throw new Error("Lokale Testschlüssel fehlen.");
  const headers = (key, token = key) => ({ apikey: key, authorization: `Bearer ${token}`, "content-type": "application/json" });
  async function call(path, options) {
    const response = await request(`${ORIGIN}${path}`, { ...options, redirect: "error" });
    if (!response.ok) throw new Error("Lokale Auth- oder REST-Prüfung fehlgeschlagen.");
    return response.json();
  }
  const accounts = [];
  for (const [rolle, tenant] of ROLE_MATRIX) {
    const email = `restore-${randomUUID()}@example.invalid`;
    const password = randomBytes(24).toString("hex");
    const user = await call("/auth/v1/admin/users", {
      method: "POST", headers: headers(serviceKey),
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { vorname: "Synthetisch", nachname: "Restore", verein: tenant } }),
    });
    if (typeof user.id !== "string" || !UUID.test(user.id)) throw new Error("Synthetisches Auth-Konto fehlt.");
    const updated = await call(`/rest/v1/profiles?id=eq.${user.id}&select=id,rolle,verein`, {
      method: "PATCH", headers: { ...headers(serviceKey), prefer: "return=representation" },
      body: JSON.stringify({ rolle, verein: [tenant] }),
    });
    if (!Array.isArray(updated) || updated.length !== 1 || updated[0].id !== user.id || updated[0].rolle !== rolle ||
        JSON.stringify(updated[0].verein) !== JSON.stringify([tenant])) throw new Error("Synthetisches Profil fehlt oder weicht ab.");
    const login = await call("/auth/v1/token?grant_type=password", {
      method: "POST", headers: headers(anonKey), body: JSON.stringify({ email, password }),
    });
    if (login.user?.id !== user.id || typeof login.access_token !== "string" || !login.access_token) throw new Error("Synthetische Anmeldung fehlgeschlagen.");
    const profile = await call(`/rest/v1/profiles?id=eq.${user.id}&select=id,rolle,verein`, {
      method: "GET", headers: headers(anonKey, login.access_token),
    });
    if (!Array.isArray(profile) || profile.length !== 1 || profile[0].id !== user.id || profile[0].rolle !== rolle ||
        JSON.stringify(profile[0].verein) !== JSON.stringify([tenant])) throw new Error("Profilprüfung über Benutzerrolle fehlgeschlagen.");
    accounts.push({ id: user.id, email, password, token: login.access_token, rolle, tenant });
  }
  return accounts;
}
