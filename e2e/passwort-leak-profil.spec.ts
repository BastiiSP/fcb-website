import { createHash } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { PASSWORT_GELEAKT_MELDUNG } from "../src/utils/passwortStaerke";

// Consent-Cookie setzen, damit der Banner nicht Klicks abfängt
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
  opts: { rolle: string },
  aufrufe: { reAuth: number; passwortUpdate: number }
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
    mannschaft: [],
  };

  await page.addInitScript(
    ({ storageKey, sessionValue }) => {
      localStorage.setItem(storageKey, JSON.stringify(sessionValue));
    },
    { storageKey: SUPABASE_AUTH_STORAGE_KEY, sessionValue: session }
  );

  await page.route("**/auth/v1/user", async (route) => {
    if (route.request().method() === "PUT") aufrufe.passwortUpdate++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(user),
    });
  });

  await page.route("**/auth/v1/token**", async (route) => {
    // Supabase nutzt denselben Pfad auch für Refresh; nur Passwort-Login zählt.
    if (new URL(route.request().url()).searchParams.get("grant_type") === "password") {
      aufrufe.reAuth++;
    }
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

const NEUES_PASSWORT = "P@ssw0rd123";
const HASH = createHash("sha1").update(NEUES_PASSWORT).digest("hex").toUpperCase();

async function oeffnePasswortFormular(page: Page, tenant: "fcb" | "jfg") {
  await page.goto(tenant === "jfg" ? "/profil?tenant=jfg" : "/profil", {
    waitUntil: "load",
  });
  await expect(page.locator("html")).toHaveAttribute("data-tenant", tenant);
  await page.getByRole("tab", { name: "Account & Sicherheit" }).click();
  return page.locator("section").filter({
    has: page.getByRole("heading", { name: "Passwort ändern" }),
  });
}

async function sendePasswortAenderung(page: Page, tenant: "fcb" | "jfg") {
  const bereich = await oeffnePasswortFormular(page, tenant);
  const passwortFelder = bereich.locator('input[type="password"]');
  await passwortFelder.nth(0).fill("Aktuelles-Passwort123!");
  await passwortFelder.nth(1).fill(NEUES_PASSWORT);
  await passwortFelder.nth(2).fill(NEUES_PASSWORT);
  await bereich.getByRole("button", { name: "Passwort ändern" }).click();
  return bereich;
}

test("bekanntes Leak blockiert vor der Re-Authentifizierung", async ({ page }) => {
  const aufrufe = { reAuth: 0, passwortUpdate: 0 };
  await seedStorage(page);
  await mockEingeloggterNutzer(page, { rolle: "mitglied" }, aufrufe);
  await page.route("**/api/passwort-leak-check**", async (route) => {
    expect(new URL(route.request().url()).searchParams.get("prefix")).toBe(HASH.slice(0, 5));
    await route.fulfill({ status: 200, body: `${HASH.slice(5)}:12345` });
  });

  const bereich = await sendePasswortAenderung(page, "fcb");
  await expect(bereich.getByText(PASSWORT_GELEAKT_MELDUNG)).toBeVisible();
  expect(aufrufe.reAuth).toBe(0);
  expect(aufrufe.passwortUpdate).toBe(0);
});

test("ohne Treffer wird das Passwort auf dem JFG-Auftritt geändert", async ({ page }) => {
  const aufrufe = { reAuth: 0, passwortUpdate: 0 };
  await seedStorage(page);
  await mockEingeloggterNutzer(page, { rolle: "mitglied" }, aufrufe);
  await page.route("**/api/passwort-leak-check**", async (route) => {
    await route.fulfill({ status: 200, body: "" });
  });

  const bereich = await sendePasswortAenderung(page, "jfg");
  await expect(bereich.getByText("Passwort erfolgreich geändert.")).toBeVisible();
  expect(aufrufe.reAuth).toBe(1);
  expect(aufrufe.passwortUpdate).toBe(1);
});

test("bei Dienstausfall bleibt die Passwortänderung möglich", async ({ page }) => {
  const aufrufe = { reAuth: 0, passwortUpdate: 0 };
  await seedStorage(page);
  await mockEingeloggterNutzer(page, { rolle: "mitglied" }, aufrufe);
  await page.route("**/api/passwort-leak-check**", async (route) => {
    await route.fulfill({ status: 502, body: "Dienst nicht erreichbar" });
  });

  const bereich = await sendePasswortAenderung(page, "fcb");
  await expect(bereich.getByText("Passwort erfolgreich geändert.")).toBeVisible();
  expect(aufrufe.reAuth).toBe(1);
  expect(aufrufe.passwortUpdate).toBe(1);
});
