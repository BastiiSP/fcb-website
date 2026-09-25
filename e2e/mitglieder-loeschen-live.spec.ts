import { expect, test, type Page, type Request } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Live-Regressionstest „Mitglied löschen“ (Bug vom 2026-09-25).
//
// WARUM gegen die echte Datenbank + echten Login: Der gemockte Test in
// mitglieder-loeschen.spec.ts ist grün, auf Production scheiterte das Löschen
// aber für ein echtes vorstand-Konto (kein DELETE-Request). Gesucht ist also
// ein Faktor, den die Mocks nicht abbilden (echte Session, echte RLS-Antworten).
//
// Gleiche Schutzregeln wie security.spec.ts: nur mit E2E_SECURITY=1, nur
// Wegwerf-Konten (e2e-sec-…@fcbuku.de) und eigene Test-Mitglieder, die in
// afterAll wieder gelöscht werden. Echte Konten/Mitglieder werden nie berührt.
// ---------------------------------------------------------------------------

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const AKTIV = process.env.E2E_SECURITY === "1" && Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);

type Verein = "fcb" | "jfg";

interface Konto {
  id: string;
  email: string;
  passwort: string;
}

interface Diagnose {
  typ: string;
  text: string;
}

const OHNE_SESSION = { auth: { persistSession: false, autoRefreshToken: false } };
const CONSENT_KEY = "fcb_consent_v1";
const CONSENT_VALUE = JSON.stringify({ notwendig: true, externeInhalte: false });

let admin: SupabaseClient;
const angelegteKonten: string[] = [];
const angelegteMitglieder: string[] = [];

async function kontoAnlegen(rolle: "vorstand" | "admin", verein: Verein[]): Promise<Konto> {
  const email = `e2e-sec-${randomUUID().slice(0, 8)}@fcbuku.de`;
  const passwort = `E2e!${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: passwort,
    email_confirm: true,
    user_metadata: { vorname: "E2E", nachname: "Loeschtest" },
  });
  if (error || !data.user) throw new Error(`Konto anlegen fehlgeschlagen: ${error?.message}`);
  angelegteKonten.push(data.user.id);

  // Rolle/Verein setzt die Service-Role direkt – die Trigger lassen das durch
  const { error: profilFehler } = await admin
    .from("profiles")
    .update({ rolle, verein })
    .eq("id", data.user.id);
  if (profilFehler) throw new Error(`Profil setzen fehlgeschlagen: ${profilFehler.message}`);
  return { id: data.user.id, email, passwort };
}

async function mitgliedAnlegen(nachname: string, verein: Verein[]): Promise<string> {
  const { data, error } = await admin
    .from("mitglieder")
    .insert({ vorname: "E2E", nachname, status: "aktiv", verein })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Mitglied anlegen fehlgeschlagen: ${error?.message}`);
  angelegteMitglieder.push(data.id as string);
  return data.id as string;
}

async function mitgliedExistiert(id: string): Promise<boolean> {
  const { data } = await admin.from("mitglieder").select("id").eq("id", id);
  return (data ?? []).length > 0;
}

/** Echter Login über das UI – bewusst kein Session-Injizieren wie im Mock-Test. */
async function einloggen(page: Page, konto: Konto) {
  await page.addInitScript(
    ({ k, v }) => localStorage.setItem(k, v),
    { k: CONSENT_KEY, v: CONSENT_VALUE }
  );
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(konto.email);
  await page.getByLabel("Passwort", { exact: true }).fill(konto.passwort);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}

test.describe("Live: Mitglied löschen mit echtem Konto", () => {
  test.skip(!AKTIV, "Nur mit E2E_SECURITY=1 und Supabase-Keys in .env.local (legt Wegwerf-Konten an)");
  test.describe.configure({ mode: "serial" });

  let vorstandFcb: Konto;
  let adminKonto: Konto;

  test.beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, OHNE_SESSION);
    vorstandFcb = await kontoAnlegen("vorstand", ["fcb"]);
    // Kontrollgruppe: Mit admin (fcb+jfg) hat das Löschen am 25.09. funktioniert
    adminKonto = await kontoAnlegen("admin", ["fcb", "jfg"]);
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

  const FAELLE = [
    { name: "vorstand (fcb) auf FCB", konto: () => vorstandFcb, tenant: "fcb" },
    { name: "vorstand (fcb) auf JFG", konto: () => vorstandFcb, tenant: "jfg" },
    { name: "admin (fcb+jfg) auf FCB", konto: () => adminKonto, tenant: "fcb" },
  ] as const;

  for (const fall of FAELLE) {
    test(`${fall.name}: Dialog zeigt Mitglied-Text und löscht wirklich`, async ({ page }, testInfo) => {
      const nachname = `Loeschtest-${randomUUID().slice(0, 6)}`;
      const mitgliedId = await mitgliedAnlegen(nachname, ["fcb"]);

      // Alles mitschneiden, was die Ursache verraten könnte
      const diagnose: Diagnose[] = [];
      const mitgliederRequests: string[] = [];
      page.on("console", (m) => diagnose.push({ typ: m.type(), text: m.text() }));
      page.on("pageerror", (e) => diagnose.push({ typ: "pageerror", text: e.stack ?? e.message }));
      page.on("request", (r: Request) => {
        if (r.url().includes("/rest/v1/mitglieder")) mitgliederRequests.push(`${r.method()} ${r.url()}`);
      });

      try {
        await einloggen(page, fall.konto());
        await page.goto(`/mitglieder?tenant=${fall.tenant}`);

        const loeschenButton = page.getByRole("button", { name: `E2E ${nachname} löschen`, exact: true });
        await expect(loeschenButton).toBeVisible({ timeout: 15_000 });
        await loeschenButton.click();

        const dialog = page.getByRole("dialog");
        await expect(dialog.getByRole("heading", { name: "Mitglied löschen", exact: true })).toBeVisible();
        await expect(dialog).toContainText(`E2E ${nachname}`);
        await expect(dialog).not.toContainText("diese Mannschaft");

        await dialog.getByRole("button", { name: "Ja, löschen", exact: true }).click();
        await expect(page.getByText(`E2E ${nachname} wurde gelöscht.`, { exact: true })).toBeVisible();
        await expect.poll(() => mitgliedExistiert(mitgliedId)).toBe(false);
      } finally {
        await testInfo.attach("diagnose", {
          body: JSON.stringify({ mitgliederRequests, diagnose }, null, 2),
          contentType: "application/json",
        });
        // Bei Fehlschlag Konsolenfehler direkt in der Ausgabe zeigen
        if (testInfo.status !== testInfo.expectedStatus) {
          console.log(JSON.stringify({ mitgliederRequests, fehler: diagnose.filter((d) => d.typ !== "log") }, null, 2));
        }
      }
    });
  }

  // Ablauf wie im Vorfall (Edge-Logs 13:25 UTC): erst per Formular anlegen, dann
  // auf derselben Seite löschen – Hinzufügen- und Löschen-Dialog nacheinander.
  test("vorstand (fcb): per Formular anlegen, dann auf derselben Seite löschen", async ({ page }, testInfo) => {
    const nachname = `Loeschtest-${randomUUID().slice(0, 6)}`;
    const diagnose: Diagnose[] = [];
    const mitgliederRequests: string[] = [];
    page.on("console", (m) => diagnose.push({ typ: m.type(), text: m.text() }));
    page.on("pageerror", (e) => diagnose.push({ typ: "pageerror", text: e.stack ?? e.message }));
    page.on("request", (r: Request) => {
      if (r.url().includes("/rest/v1/mitglieder")) mitgliederRequests.push(`${r.method()} ${r.url()}`);
    });

    try {
      await einloggen(page, vorstandFcb);
      await page.goto("/mitglieder");
      await page.getByRole("button", { name: "Mitglied hinzufügen" }).click();
      const formular = page.getByRole("dialog");
      await formular.getByLabel("Vorname").fill("E2E");
      await formular.getByLabel("Nachname").fill(nachname);
      await formular.getByRole("button", { name: "Speichern" }).click();
      await expect(page.getByText("Mitglied erfolgreich hinzugefügt.")).toBeVisible();

      // Angelegte ID für afterAll merken, falls das Löschen scheitert
      const { data } = await admin.from("mitglieder").select("id").eq("nachname", nachname);
      const id = (data?.[0]?.id as string | undefined) ?? "";
      expect(id, "Mitglied wurde nicht angelegt").not.toBe("");
      angelegteMitglieder.push(id);

      await page.getByRole("button", { name: `E2E ${nachname} löschen`, exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Mitglied löschen", exact: true })).toBeVisible();
      await expect(dialog).toContainText(`E2E ${nachname}`);
      await dialog.getByRole("button", { name: "Ja, löschen", exact: true }).click();
      await expect(page.getByText(`E2E ${nachname} wurde gelöscht.`, { exact: true })).toBeVisible();
      await expect.poll(() => mitgliedExistiert(id)).toBe(false);
    } finally {
      await testInfo.attach("diagnose", {
        body: JSON.stringify({ mitgliederRequests, diagnose }, null, 2),
        contentType: "application/json",
      });
      if (testInfo.status !== testInfo.expectedStatus) {
        console.log(JSON.stringify({ mitgliederRequests, fehler: diagnose.filter((d) => d.typ !== "log") }, null, 2));
      }
    }
  });
});
