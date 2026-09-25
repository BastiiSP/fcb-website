import { test, expect, type Page } from "@playwright/test";
import type { Mitglied } from "../src/components/MitgliedBearbeitenModal";

// Session-Muster bewusst aus smoke.spec.ts übernommen; keine echten Konten nötig.
const CONSENT_KEY = "fcb_consent_v1";
const CONSENT_VALUE = JSON.stringify({ notwendig: true, externeInhalte: false });
const THEME_KEY = "theme";
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jktvmckqfklfziszfsxf.supabase.co";
const SUPABASE_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const SUPABASE_AUTH_STORAGE_KEY = `sb-${SUPABASE_REF}-auth-token`;
const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_USER_EMAIL = "basti.test@example.com";

/** Setzt Consent + optionales Theme via addInitScript, bevor die Seite lädt. */
async function seedStorage(
  page: Page,
  opts: { theme?: "dark" | "light" } = {}
) {
  await page.addInitScript(
    ({ consentKey, consentValue, themeKey, theme }) => {
      localStorage.setItem(consentKey, consentValue);
      if (theme) localStorage.setItem(themeKey, theme);
    },
    {
      consentKey: CONSENT_KEY,
      consentValue: CONSENT_VALUE,
      themeKey: THEME_KEY,
      theme: opts.theme ?? null,
    }
  );
}

/** Mockt eine eingeloggte Supabase-Session plus Profilrolle für clientseitige Gates. */
async function mockEingeloggterNutzer(
  page: Page,
  opts: { rolle: "vorstand" | "admin"; verein: "fcb" | "jfg" }
) {
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: TEST_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: TEST_USER_EMAIL,
    email_confirmed_at: new Date(now * 1000).toISOString(),
    phone: "",
    confirmed_at: new Date(now * 1000).toISOString(),
    last_sign_in_at: new Date(now * 1000).toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: new Date(now * 1000).toISOString(),
    updated_at: new Date(now * 1000).toISOString(),
    is_anonymous: false,
  };
  const session = {
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    user,
  };
  const profile = {
    id: TEST_USER_ID,
    vorname: "Basti",
    nachname: "Tester",
    email: TEST_USER_EMAIL,
    telefonnummer: null,
    avatar_url: null,
    rolle: opts.rolle,
    verein: [opts.verein],
    mannschaft: [],
  };

  await page.addInitScript(
    ({ storageKey, sessionValue }) => {
      localStorage.setItem(storageKey, JSON.stringify(sessionValue));
    },
    { storageKey: SUPABASE_AUTH_STORAGE_KEY, sessionValue: session }
  );

  await page.route("**/auth/v1/user", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(user),
    });
  });

  await page.route("**/auth/v1/token**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(session),
    });
  });

  await page.route("**/rest/v1/profiles**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": "0-0/1" },
      body: JSON.stringify(profile),
    });
  });
}

interface BrowserDiagnose {
  typ: string;
  text: string;
}

// Vollständige Meldungen inkl. React-Diff bleiben als Testanhang erhalten.
// Insbesondere Hydration-Fehler werden hier nicht wie im alten Smoke-Filter ausgeblendet.
const testMitDiagnose = test.extend<{ browserDiagnose: BrowserDiagnose[] }>({
  browserDiagnose: [async ({ page }, use, testInfo) => {
    const meldungen: BrowserDiagnose[] = [];
    page.on("console", (meldung) => {
      meldungen.push({ typ: meldung.type(), text: meldung.text() });
    });
    page.on("pageerror", (fehler) => {
      meldungen.push({ typ: "pageerror", text: fehler.stack ?? fehler.message });
    });
    await use(meldungen);
    await testInfo.attach("browser-diagnose", {
      body: JSON.stringify(meldungen, null, 2),
      contentType: "application/json",
    });
  }, { auto: true }],
});

for (const verein of ["fcb", "jfg"] as const) {
  for (const rolle of ["vorstand", "admin"] as const) {
    testMitDiagnose(`${verein}/${rolle}: Mitglied löschen sendet die gewählte ID und meldet Erfolg`, async ({ page }, testInfo) => {
      await seedStorage(page, { theme: rolle === "admin" ? "light" : "dark" });

      // Unbekannte Supabase-Aufrufe dürfen niemals zur echten Datenbank gelangen.
      // Spezifische Routen werden anschließend registriert und haben Vorrang.
      await page.route("**/auth/v1/**", (route) => route.abort());
      await page.route("**/rest/v1/**", (route) => route.abort());
      await mockEingeloggterNutzer(page, { rolle, verein });

      let mitglieder: Mitglied[] = [
        {
          id: "22222222-2222-4222-8222-222222222222",
          mitgliedsnummer: 101,
          vorname: "Anna",
          nachname: "Beispiel",
          email: "anna@example.com",
          telefonnummer: null,
          geburtsdatum: null,
          eintrittsdatum: "2026-01-01",
          status: "aktiv",
          mannschaft: [],
          verein: [verein],
          notizen: null,
          erstellt_von: TEST_USER_ID,
          created_at: "2026-01-01T12:00:00Z",
          updated_at: "2026-01-01T12:00:00Z",
        },
        {
          id: "33333333-3333-4333-8333-333333333333",
          mitgliedsnummer: 102,
          vorname: "Bernd",
          nachname: "Muster",
          email: null,
          telefonnummer: null,
          geburtsdatum: null,
          eintrittsdatum: null,
          status: "passiv",
          mannschaft: [],
          verein: [verein],
          notizen: null,
          erstellt_von: TEST_USER_ID,
          created_at: "2026-01-01T12:00:00Z",
          updated_at: "2026-01-01T12:00:00Z",
        },
      ];
      const geloeschteIds: (string | null)[] = [];
      await page.route("**/rest/v1/mitglieder**", async (route) => {
        const request = route.request();
        if (request.method() === "GET") {
          await route.fulfill({ json: mitglieder });
        } else if (request.method() === "DELETE") {
          const idFilter = new URL(request.url()).searchParams.get("id");
          geloeschteIds.push(idFilter);
          mitglieder = mitglieder.filter((mitglied) => `eq.${mitglied.id}` !== idFilter);
          await route.fulfill({ status: 204 });
        } else {
          await route.abort();
        }
      });

      try {
        await page.goto(`/mitglieder?tenant=${verein}`);
        await expect(page.getByRole("button", { name: "Anna Beispiel löschen", exact: true })).toBeVisible();
        // Auch nach einem vollständigen Neuladen muss die Auswahl funktionieren.
        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("data-tenant", verein);
        await expect(page.locator("html")).toHaveClass(rolle === "admin" ? /light/ : /dark/);
        const akzent = await page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim()
        );
        expect(akzent).toBe(verein === "fcb" ? "29 95 173" : "204 31 31");

        await page.getByRole("button", { name: "Anna Beispiel löschen", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog.getByRole("heading", { name: "Mitglied löschen", exact: true })).toBeVisible();
        await expect(dialog).toContainText("Anna Beispiel");
        await expect(dialog).not.toContainText("diese Mannschaft");
        await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
        await expect(dialog).toBeHidden();
        expect(geloeschteIds).toEqual([]);

        // Eine zweite Person erkennt zusätzlich eine versehentlich festgehaltene alte ID.
        await page.getByRole("button", { name: "Bernd Muster löschen", exact: true }).click();
        await expect(dialog.getByRole("heading", { name: "Mitglied löschen", exact: true })).toBeVisible();
        await expect(dialog).toContainText("Bernd Muster");
        await dialog.getByRole("button", { name: "Ja, löschen", exact: true }).click();
        await expect.poll(() => geloeschteIds).toEqual(["eq.33333333-3333-4333-8333-333333333333"]);
        await expect(page.getByText("Bernd Muster wurde gelöscht.", { exact: true })).toBeVisible();
        await expect(dialog).toBeHidden();
        await expect(page.getByRole("button", { name: "Bernd Muster löschen", exact: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Anna Beispiel löschen", exact: true })).toBeVisible();
      } finally {
        await testInfo.attach("delete-anfragen", {
          body: JSON.stringify(geloeschteIds, null, 2),
          contentType: "application/json",
        });
      }
    });
  }
}
