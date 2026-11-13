import { randomUUID } from "node:crypto";

const ORIGIN = "https://127.0.0.1:8000";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Alle Abfragen sind auf neu erzeugte synthetische IDs begrenzt.
export async function pruefeRollen(accounts, serviceKey, anonKey, request = fetch) {
  const headers = (key, token = key) => ({ apikey: key, authorization: `Bearer ${token}`, "content-type": "application/json" });
  const konto = (rolle, tenant) => {
    const matches = accounts.filter((entry) => entry.rolle === rolle && (!tenant || entry.tenant === tenant));
    if (matches.length !== 1 || !UUID.test(matches[0].id) || !matches[0].token) throw new Error("Synthetisches Rollenkonto fehlt.");
    return matches[0];
  };
  const vorstandFcb = konto("vorstand", "fcb");
  const vorstandJfg = konto("vorstand", "jfg");
  const admin = konto("admin");
  const mitglied = konto("mitglied");
  const trainer = konto("trainer", "fcb");
  const andererTrainer = konto("trainer", "jfg");
  const ids = { fcb: randomUUID(), jfg: randomUUID() };
  const raw = (url, options) => request(`${ORIGIN}${url}`, { ...options, redirect: "error" });
  async function erwarteteSperre(response) {
    if (response.ok) return;
    if (![400, 403].includes(response.status)) throw new Error("Unerwarteter Fehler bei synthetischer Sperrprüfung.");
    let body;
    try { body = await response.json(); } catch { throw new Error("Ungültige Antwort bei synthetischer Sperrprüfung."); }
    if (!["42501", "P0001"].includes(body?.code)) throw new Error("Unerwartete Fehlerklasse bei synthetischer Sperrprüfung.");
  }
  const fixtureResponse = await raw("/rest/v1/mitglieder", {
    method: "POST", headers: { ...headers(serviceKey), prefer: "return=minimal" },
    body: JSON.stringify(Object.entries(ids).map(([tenant, id]) => ({ id, vorname: "Synthetisch", nachname: "Restore", verein: [tenant] }))),
  });
  if (!fixtureResponse.ok) throw new Error("Synthetische Mitglieder konnten nicht angelegt werden.");
  const query = `/rest/v1/mitglieder?id=in.(${ids.fcb},${ids.jfg})&select=id`;
  for (const [account, expected] of [[vorstandFcb, [ids.fcb]], [vorstandJfg, [ids.jfg]], [admin, [ids.fcb, ids.jfg]], [mitglied, []]]) {
    const response = await raw(query, { method: "GET", headers: headers(anonKey, account.token) });
    if (!response.ok) throw new Error("Synthetische Tenant-Abfrage fehlgeschlagen.");
    const rows = await response.json();
    if (!Array.isArray(rows) || JSON.stringify(rows.map((row) => row.id).sort()) !== JSON.stringify([...expected].sort())) {
      throw new Error("Synthetische Tenant-Trennung weicht ab.");
    }
  }
  // Verweigerte Änderungen können auch HTTP 204 mit null betroffenen Zeilen sein.
  await erwarteteSperre(await raw(`/rest/v1/profiles?id=eq.${mitglied.id}`, {
    method: "PATCH", headers: headers(anonKey, mitglied.token), body: JSON.stringify({ rolle: "admin" }),
  }));
  const own = await raw(`/rest/v1/profiles?id=eq.${mitglied.id}&select=id,rolle`, { method: "GET", headers: headers(anonKey, mitglied.token) });
  if (!own.ok) throw new Error("Synthetische Selbstrollenprüfung fehlgeschlagen.");
  const ownProfile = await own.json();
  if (!Array.isArray(ownProfile) || ownProfile.length !== 1 || ownProfile[0].id !== mitglied.id || ownProfile[0].rolle !== "mitglied") {
    throw new Error("Synthetische Selbstrollenänderung wurde nicht verhindert.");
  }
  await erwarteteSperre(await raw(`/rest/v1/profiles?id=eq.${admin.id}`, {
    method: "PATCH", headers: headers(anonKey, vorstandFcb.token), body: JSON.stringify({ rolle: "mitglied" }),
  }));
  const adminRead = await raw(`/rest/v1/profiles?id=eq.${admin.id}&select=id,rolle`, { method: "GET", headers: headers(anonKey, admin.token) });
  if (!adminRead.ok) throw new Error("Synthetische Adminprüfung fehlgeschlagen.");
  const adminProfile = await adminRead.json();
  if (!Array.isArray(adminProfile) || adminProfile.length !== 1 || adminProfile[0].id !== admin.id || adminProfile[0].rolle !== "admin") {
    throw new Error("Synthetische Adminrolle wurde unerlaubt verändert.");
  }
  const bookingId = randomUUID();
  const bookingUrl = `/rest/v1/buchungen?id=eq.${bookingId}`;
  const created = await raw("/rest/v1/buchungen", {
    method: "POST", headers: { ...headers(anonKey, trainer.token), prefer: "return=minimal" },
    body: JSON.stringify({ id: bookingId, platz: "hauptplatz", platzanteil: "ganz", anlass: "training",
      startzeit: "2040-05-01T10:00:00Z", endzeit: "2040-05-01T11:00:00Z", mannschaft: "Synthetisch",
      buchende_person: "Synthetisch", user_id: trainer.id }),
  });
  if (!created.ok) throw new Error("Synthetische Trainerbuchung fehlgeschlagen.");
  const changed = await raw(bookingUrl, { method: "PATCH", headers: headers(anonKey, trainer.token), body: JSON.stringify({ bemerkung: "synthetisch-eigen" }) });
  if (!changed.ok) throw new Error("Eigene synthetische Buchung konnte nicht geändert werden.");
  const ownBooking = await raw(`${bookingUrl}&select=id,bemerkung`, { method: "GET", headers: headers(anonKey, trainer.token) });
  if (!ownBooking.ok) throw new Error("Synthetische Buchungsprüfung fehlgeschlagen.");
  const before = await ownBooking.json();
  if (!Array.isArray(before) || before.length !== 1 || before[0].bemerkung !== "synthetisch-eigen") throw new Error("Eigene Buchung wurde nicht geändert.");
  await erwarteteSperre(await raw(bookingUrl, { method: "PATCH", headers: headers(anonKey, andererTrainer.token), body: JSON.stringify({ bemerkung: "synthetisch-fremd" }) }));
  const afterResponse = await raw(`${bookingUrl}&select=id,bemerkung`, { method: "GET", headers: headers(anonKey, trainer.token) });
  if (!afterResponse.ok) throw new Error("Synthetische Fremdbuchungsprüfung fehlgeschlagen.");
  const after = await afterResponse.json();
  if (!Array.isArray(after) || after.length !== 1 || after[0].bemerkung !== "synthetisch-eigen") throw new Error("Fremde Buchung wurde unerlaubt geändert.");
  return { tenantCases: 4, roleCases: 2, bookingCases: 2 };
}
