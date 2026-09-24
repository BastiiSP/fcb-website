import { expect, test, type APIRequestContext } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Sicherheits-Regressionstests (Audit 2026-09-24): H1 Rollen-Degradation,
// M1 Fremdprofil-Änderungen, H2 benutzer-ablehnen-Zielprüfung, Tenant-Trennung
// der Mitgliederdaten (FCB ↔ JFG) und L2 Trainer-Verzeichnis.
//
// WARUM gegen die echte Datenbank: Die Zugriffskontrolle lebt in RLS-Policies
// und Triggern, nicht im Frontend. Ein UI-Mock würde genau die Schicht
// überspringen, die hier geschützt werden soll.
//
// WICHTIG: Lokal zeigt .env.local auf die LIVE-Datenbank. Deshalb:
//  - läuft die Suite nur mit E2E_SECURITY=1 (npm run test:e2e:security),
//    damit ein normales `npm run test:e2e` keine Auth-Konten anlegt;
//  - arbeitet sie ausschließlich mit Wegwerf-Konten (e2e-sec-…@fcbuku.de),
//    die per Service-Role angelegt (ohne Mail-Versand) und in afterAll
//    wieder gelöscht werden – die dokumentierten test-*@fcbuku.de-Konten und
//    echte Konten werden nie angefasst.
// ---------------------------------------------------------------------------

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const AKTIV = process.env.E2E_SECURITY === "1" && Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);

type Rolle = "ausstehend" | "mitglied" | "trainer" | "vorstand" | "admin";
type Verein = "fcb" | "jfg";

interface TestKonto {
  id: string;
  email: string;
  client: SupabaseClient;
  accessToken: string;
}

const OHNE_SESSION = { auth: { persistSession: false, autoRefreshToken: false } };

let admin: SupabaseClient;
const angelegteKonten: string[] = [];
const angelegteMitglieder: string[] = [];

/**
 * Legt ein Wegwerf-Konto mit Rolle + Verein an und meldet es an.
 * Rolle/Verein setzt die Service-Role direkt – die Trigger lassen
 * auth.role() = 'service_role' bewusst durch (serverseitiges Admin-Tooling).
 */
async function kontoAnlegen(rolle: Rolle, verein: Verein[] = ["fcb"]): Promise<TestKonto> {
  const email = `e2e-sec-${randomUUID().slice(0, 8)}@fcbuku.de`;
  const passwort = `E2e!${randomUUID()}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: passwort,
    email_confirm: true,
    user_metadata: { vorname: "E2E", nachname: "Sicherheitstest" },
  });
  if (error || !data.user) throw new Error(`Konto anlegen fehlgeschlagen: ${error?.message}`);
  angelegteKonten.push(data.user.id);

  const { error: profilFehler } = await admin
    .from("profiles")
    .update({ rolle, verein })
    .eq("id", data.user.id);
  if (profilFehler) throw new Error(`Profil setzen fehlgeschlagen: ${profilFehler.message}`);

  const client = createClient(SUPABASE_URL, ANON_KEY, OHNE_SESSION);
  const { data: login, error: loginFehler } = await client.auth.signInWithPassword({
    email,
    password: passwort,
  });
  if (loginFehler || !login.session) throw new Error(`Login fehlgeschlagen: ${loginFehler?.message}`);

  return { id: data.user.id, email, client, accessToken: login.session.access_token };
}

async function rolleVon(id: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("rolle").eq("id", id).single();
  return (data?.rolle as string | undefined) ?? null;
}

async function kontoExistiert(id: string): Promise<boolean> {
  const { data } = await admin.auth.admin.getUserById(id);
  return Boolean(data.user);
}

async function mitgliedAnlegen(verein: Verein[]): Promise<string> {
  const { data, error } = await admin
    .from("mitglieder")
    .insert({ vorname: "E2E", nachname: `Tenant-${verein.join("+")}`, status: "aktiv", verein })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Mitglied anlegen fehlgeschlagen: ${error?.message}`);
  angelegteMitglieder.push(data.id as string);
  return data.id as string;
}

test.describe("Sicherheit: Rollen, Konten-Löschung, Tenant-Trennung", () => {
  test.skip(!AKTIV, "Nur mit E2E_SECURITY=1 und Supabase-Keys in .env.local (legt Wegwerf-Konten an)");
  // Seriell: Die Tests teilen sich die Wegwerf-Konten aus beforeAll.
  test.describe.configure({ mode: "serial" });

  let vorstandFcb: TestKonto;
  let vorstandJfg: TestKonto;
  let adminKonto: TestKonto;
  let zweiterVorstand: TestKonto;
  let mitglied: TestKonto;
  let trainer: TestKonto;

  test.beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, OHNE_SESSION);
    vorstandFcb = await kontoAnlegen("vorstand", ["fcb"]);
    vorstandJfg = await kontoAnlegen("vorstand", ["jfg"]);
    zweiterVorstand = await kontoAnlegen("vorstand", ["fcb"]);
    adminKonto = await kontoAnlegen("admin", []);
    mitglied = await kontoAnlegen("mitglied", ["fcb"]);
    trainer = await kontoAnlegen("trainer", ["fcb"]);
  });

  test.afterAll(async () => {
    if (!admin) return;
    if (angelegteMitglieder.length) {
      await admin.from("mitglieder").delete().in("id", angelegteMitglieder);
    }
    for (const id of angelegteKonten) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  // --- H1: Eskalation UND Degradation von vorstand/admin nur durch admin ----

  test("H1: Vorstand kann einen Admin nicht herabstufen", async () => {
    const { error } = await vorstandFcb.client
      .from("profiles")
      .update({ rolle: "mitglied" })
      .eq("id", adminKonto.id);
    // RLS filtert die Zeile (kein Fehler, 0 Zeilen) oder der Trigger wirft –
    // entscheidend ist allein, dass die Rolle danach unverändert ist.
    void error;
    expect(await rolleVon(adminKonto.id)).toBe("admin");
  });

  test("H1: Vorstand kann einen anderen Vorstand nicht herabstufen", async () => {
    await vorstandFcb.client.from("profiles").update({ rolle: "ausstehend" }).eq("id", zweiterVorstand.id);
    expect(await rolleVon(zweiterVorstand.id)).toBe("vorstand");
  });

  test("H1: Vorstand kann niemanden zum Vorstand befördern", async () => {
    await vorstandFcb.client.from("profiles").update({ rolle: "vorstand" }).eq("id", mitglied.id);
    expect(await rolleVon(mitglied.id)).toBe("mitglied");
  });

  test("H1: Vorstand darf zwischen mitglied und trainer wechseln (Positivkontrolle)", async () => {
    const { error } = await vorstandFcb.client.from("profiles").update({ rolle: "trainer" }).eq("id", mitglied.id);
    expect(error).toBeNull();
    expect(await rolleVon(mitglied.id)).toBe("trainer");
    await vorstandFcb.client.from("profiles").update({ rolle: "mitglied" }).eq("id", mitglied.id);
    expect(await rolleVon(mitglied.id)).toBe("mitglied");
  });

  test("H1: Admin darf einen Vorstand herabstufen und wieder befördern", async () => {
    const runter = await adminKonto.client.from("profiles").update({ rolle: "mitglied" }).eq("id", zweiterVorstand.id);
    expect(runter.error).toBeNull();
    expect(await rolleVon(zweiterVorstand.id)).toBe("mitglied");
    const hoch = await adminKonto.client.from("profiles").update({ rolle: "vorstand" }).eq("id", zweiterVorstand.id);
    expect(hoch.error).toBeNull();
    expect(await rolleVon(zweiterVorstand.id)).toBe("vorstand");
  });

  test("H1: Niemand kann die eigene Rolle oder den eigenen Verein ändern", async () => {
    await mitglied.client.from("profiles").update({ rolle: "admin" }).eq("id", mitglied.id);
    expect(await rolleVon(mitglied.id)).toBe("mitglied");

    const { error } = await vorstandFcb.client.from("profiles").update({ verein: ["fcb", "jfg"] }).eq("id", vorstandFcb.id);
    expect(error).not.toBeNull();
    const { data } = await admin.from("profiles").select("verein").eq("id", vorstandFcb.id).single();
    expect(data?.verein).toEqual(["fcb"]);
  });

  // --- M1: Vorstand darf bei fremden Profilen nur die Rolle ändern ---------

  test("M1: Vorstand kann Stammdaten fremder Profile nicht ändern", async () => {
    const { error } = await vorstandFcb.client
      .from("profiles")
      .update({ vorname: "Manipuliert", avatar_url: "https://evil.example/pixel.png" })
      .eq("id", mitglied.id);
    expect(error).not.toBeNull();
    const { data } = await admin.from("profiles").select("vorname, avatar_url").eq("id", mitglied.id).single();
    expect(data?.vorname).toBe("E2E");
    expect(data?.avatar_url).toBeNull();
  });

  // --- H2: /api/benutzer-ablehnen wirkt nur auf 'ausstehend'-Konten --------

  async function ablehnen(request: APIRequestContext, token: string | null, userId: string) {
    return request.post("/api/benutzer-ablehnen", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      data: { userId },
    });
  }

  test("H2: ohne Token → 401", async ({ request }) => {
    const res = await ablehnen(request, null, mitglied.id);
    expect(res.status()).toBe(401);
    expect(await kontoExistiert(mitglied.id)).toBe(true);
  });

  test("H2: Vorstand kann freigeschaltetes Mitglied NICHT löschen", async ({ request }) => {
    const res = await ablehnen(request, vorstandFcb.accessToken, mitglied.id);
    expect(res.status()).toBe(403);
    expect(await kontoExistiert(mitglied.id)).toBe(true);
  });

  test("H2: Vorstand kann Admin NICHT löschen", async ({ request }) => {
    const res = await ablehnen(request, vorstandFcb.accessToken, adminKonto.id);
    expect(res.status()).toBe(403);
    expect(await kontoExistiert(adminKonto.id)).toBe(true);
  });

  test("H2: Mitglied als Aufrufer → 403", async ({ request }) => {
    const ausstehend = await kontoAnlegen("ausstehend", []);
    const res = await ablehnen(request, mitglied.accessToken, ausstehend.id);
    expect(res.status()).toBe(403);
    expect(await kontoExistiert(ausstehend.id)).toBe(true);
  });

  test("H2: Vorstand kann ausstehende Registrierung ablehnen (Positivkontrolle)", async ({ request }) => {
    const ausstehend = await kontoAnlegen("ausstehend", []);
    const res = await ablehnen(request, vorstandFcb.accessToken, ausstehend.id);
    expect(res.status()).toBe(200);
    expect(await kontoExistiert(ausstehend.id)).toBe(false);
  });

  // --- Tenant-Trennung: JFG-Vorstand sieht keine FCB-Mitglieder und umgekehrt

  test("Tenant: Vorstände sehen nur Mitglieder des eigenen Vereins, Admin alle", async () => {
    const fcbMitglied = await mitgliedAnlegen(["fcb"]);
    const jfgMitglied = await mitgliedAnlegen(["jfg"]);
    const beide = await mitgliedAnlegen(["fcb", "jfg"]);
    const ids = [fcbMitglied, jfgMitglied, beide];

    const sichtbar = async (konto: TestKonto) => {
      const { data, error } = await konto.client.from("mitglieder").select("id").in("id", ids);
      expect(error).toBeNull();
      return (data ?? []).map((z) => z.id as string).sort();
    };

    expect(await sichtbar(vorstandFcb)).toEqual([fcbMitglied, beide].sort());
    expect(await sichtbar(vorstandJfg)).toEqual([jfgMitglied, beide].sort());
    expect(await sichtbar(adminKonto)).toEqual([...ids].sort());
    // Trainer haben laut Rollenkonzept gar keinen Zugriff auf mitglieder.
    expect(await sichtbar(trainer)).toEqual([]);
  });

  test("Tenant: FCB-Vorstand kann JFG-Mitglieder weder anlegen noch ändern", async () => {
    const anlegen = await vorstandFcb.client
      .from("mitglieder")
      .insert({ vorname: "E2E", nachname: "Fremdverein", status: "aktiv", verein: ["jfg"] })
      .select("id");
    expect(anlegen.error).not.toBeNull();

    const jfgMitglied = await mitgliedAnlegen(["jfg"]);
    await vorstandFcb.client.from("mitglieder").update({ notizen: "manipuliert" }).eq("id", jfgMitglied);
    const { data } = await admin.from("mitglieder").select("notizen").eq("id", jfgMitglied).single();
    expect(data?.notizen).toBeNull();

    // Eigenes Mitglied dem Fremdverein zuschieben = Datenweitergabe → blockiert.
    const fcbMitglied = await mitgliedAnlegen(["fcb"]);
    const teilen = await vorstandFcb.client.from("mitglieder").update({ verein: ["fcb", "jfg"] }).eq("id", fcbMitglied);
    expect(teilen.error).not.toBeNull();
  });

  // --- L2: Trainer sehen andere Profile nur noch über die RPC ---------------

  test("L2: Trainer liest fremde Profile nicht mehr direkt, RPC liefert nur freigegebene Spalten", async () => {
    const direkt = await trainer.client.from("profiles").select("id, geburtsdatum").eq("id", vorstandFcb.id);
    expect(direkt.data ?? []).toEqual([]);

    const { data, error } = await trainer.client.rpc("trainer_verzeichnis");
    expect(error).toBeNull();
    const eintrag = (data as Record<string, unknown>[]).find((z) => z.id === vorstandFcb.id);
    expect(eintrag).toBeDefined();
    expect(eintrag).not.toHaveProperty("geburtsdatum");

    const alsMitglied = await mitglied.client.rpc("trainer_verzeichnis");
    expect((alsMitglied.data as unknown[] | null) ?? []).toEqual([]);
  });
});
