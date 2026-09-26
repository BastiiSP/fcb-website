import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PASSWORT_GELEAKT_MELDUNG } from "../src/utils/passwortStaerke";

const PASSWORT = "P@ssw0rd123";
const HASH = createHash("sha1").update(PASSWORT).digest("hex").toUpperCase();
const SUFFIX = HASH.slice(5);
const FREMDER_SUFFIX = "0".repeat(35);

async function registrierungVorbereiten(page: Page, pfad = "/registrieren") {
  // Consent muss vor der Navigation vorliegen, damit der Banner das Formular nicht verdeckt.
  await page.addInitScript(() => {
    localStorage.setItem(
      "fcb_consent_v1",
      JSON.stringify({ notwendig: true, externeInhalte: false }),
    );
  });
  await page.goto(pfad);
  await page.getByLabel("Vorname", { exact: true }).fill("Test");
  await page.getByLabel("Nachname", { exact: true }).fill("Nutzer");
  await page.getByLabel("E-Mail", { exact: true }).fill("test@example.com");
  await page.getByLabel("Passwort", { exact: true }).fill(PASSWORT);
  await page.getByLabel("Passwort bestätigen", { exact: true }).fill(PASSWORT);
}

async function signupAbfangen(page: Page): Promise<() => number> {
  let aufrufe = 0;
  await page.route("**/auth/v1/signup**", async (route) => {
    aufrufe++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "c60b12d6-c185-4a79-bf0d-738d11d11b50",
          aud: "authenticated",
          role: "authenticated",
          email: "test@example.com",
          email_confirmed_at: null,
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: { vorname: "Test", nachname: "Nutzer" },
          created_at: "2026-09-26T12:00:00.000Z",
        },
        session: null,
      }),
    });
  });
  return () => aufrufe;
}

test("geleaktes Passwort stoppt die Registrierung und sendet nur das Hash-Präfix", async ({ page }) => {
  const signupAufrufe = await signupAbfangen(page);
  let leakAnfrage = "";
  await page.route("**/api/passwort-leak-check**", async (route) => {
    leakAnfrage = route.request().url();
    await route.fulfill({ status: 200, contentType: "text/plain", body: `${SUFFIX}:12345\r\n` });
  });
  await registrierungVorbereiten(page, "/registrieren?tenant=jfg");
  await expect(page.locator("html")).toHaveAttribute("data-tenant", "jfg");

  await page.getByRole("button", { name: "Jetzt registrieren" }).click();

  await expect(page.getByText(PASSWORT_GELEAKT_MELDUNG)).toBeVisible();
  expect(signupAufrufe()).toBe(0);
  expect(leakAnfrage).not.toBe("");
  const url = new URL(leakAnfrage);
  expect(url.searchParams.get("prefix")).toBe(HASH.slice(0, 5));
  expect(url.searchParams.size).toBe(1);
  expect(leakAnfrage).not.toContain(PASSWORT);
  expect(leakAnfrage).not.toContain(SUFFIX);
});

test("ohne Treffer wird die Registrierung fortgesetzt", async ({ page }) => {
  const signupAufrufe = await signupAbfangen(page);
  let antwortFreigeben = () => {};
  const antwortFreigabe = new Promise<void>((resolve) => { antwortFreigeben = resolve; });
  await page.route("**/api/passwort-leak-check**", async (route) => {
    await antwortFreigabe;
    await route.fulfill({ status: 200, contentType: "text/plain", body: `${FREMDER_SUFFIX}:12\n` });
  });
  await registrierungVorbereiten(page);

  const submit = page.getByRole("button", { name: "Jetzt registrieren" });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(submit).toBeDisabled();
  antwortFreigeben();

  await expect(page.getByRole("heading", { name: "Fast geschafft" })).toBeVisible();
  expect(signupAufrufe()).toBe(1);
});

test("bei Ausfall der Leak-Prüfung wird die Registrierung fortgesetzt", async ({ page }) => {
  const signupAufrufe = await signupAbfangen(page);
  await page.route("**/api/passwort-leak-check**", async (route) => {
    await route.fulfill({ status: 502, contentType: "application/json", body: '{"fehler":"Dienst nicht erreichbar"}' });
  });
  await registrierungVorbereiten(page);

  await page.getByRole("button", { name: "Jetzt registrieren" }).click();

  await expect(page.getByRole("heading", { name: "Fast geschafft" })).toBeVisible();
  expect(signupAufrufe()).toBe(1);
});
