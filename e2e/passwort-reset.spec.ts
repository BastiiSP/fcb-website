import { expect, test as basisTest, type Page, type Route } from "@playwright/test";

const PASSWORT = "Sicher!Pass2026x";
const EMAIL = "test@example.com";
const NUTZER_ID = "c60b12d6-c185-4a79-bf0d-738d11d11b50";

interface AuthAufruf {
  methode: string;
  url: string;
  body: Record<string, unknown> | null;
}

type AuthAntwort = (route: Route) => Promise<void>;

interface AuthMock {
  aufrufe: AuthAufruf[];
  antworten: Map<string, AuthAntwort>;
}

const test = basisTest.extend<{ auth: AuthMock }>({
  // auto: true – Catch-all und Consent gelten auch für Tests, die `auth` nicht
  // ausdrücklich anfordern; sonst liefen deren Auth-Requests ungeschützt live.
  auth: [async ({ page }, use) => {
    const auth: AuthMock = { aufrufe: [], antworten: new Map() };
    const unerwartet: string[] = [];

    // Die Live-URL steht in .env.local: Der Catch-all muss vor jeder Navigation aktiv sein.
    await page.route("**/auth/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const endpunkt = url.pathname.slice(url.pathname.indexOf("/auth/v1/") + "/auth/v1".length);
      const schluessel = `${request.method()} ${endpunkt}`;
      const antwort = auth.antworten.get(schluessel);
      if (!antwort) {
        unerwartet.push(request.url());
        await route.abort();
        return;
      }
      auth.aufrufe.push({
        methode: request.method(),
        url: request.url(),
        body: request.postDataJSON() as Record<string, unknown> | null,
      });
      await antwort(route);
    });
    await page.route("**/api/passwort-leak-check**", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/plain", body: "" });
    });
    await page.addInitScript(() => {
      localStorage.setItem(
        "fcb_consent_v1",
        JSON.stringify({ notwendig: true, externeInhalte: false }),
      );
    });

    await use(auth);
    expect(unerwartet, "Unerwartete Auth-Requests zur Live-Supabase-URL").toEqual([]);
  }, { auto: true }],
});

test("Mail-Link auf der Startseite wird zur passenden Seite umgeleitet", async ({ page }) => {
  // Site-URL-Rückfall von Supabase: Link ohne Pfad landet auf "/".
  await page.goto("/?token_hash=abc&type=recovery");
  await expect(page).toHaveURL(/\/passwort-neu\?token_hash=abc&type=recovery$/);
  await page.goto("/?token_hash=abc&type=email_change");
  await expect(page).toHaveURL(/\/confirm-email\?token_hash=abc&type=email_change$/);
});

function jsonAntwort(status: number, body: object): AuthAntwort {
  return async (route) => {
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  };
}

function sitzung(provider: "email" | "google") {
  const user = {
    id: NUTZER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: EMAIL,
    identities: [{ id: "identity-1", user_id: NUTZER_ID, provider }],
    app_metadata: { provider, providers: [provider] },
    user_metadata: {},
    created_at: "2026-10-24T12:00:00.000Z",
  };
  return {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user,
  };
}

async function neuesPasswortAusfuellen(page: Page, passwort = PASSWORT) {
  await page.getByLabel("Neues Passwort", { exact: true }).fill(passwort);
  await page.getByLabel("Neues Passwort bestätigen", { exact: true }).fill(passwort);
}

function aufrufe(auth: AuthMock, endpunkt: string): AuthAufruf[] {
  return auth.aufrufe.filter((aufruf) => new URL(aufruf.url).pathname.endsWith(endpunkt));
}

test("Login verlinkt auf Passwort vergessen", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-tenant", "fcb");
  await page.getByRole("link", { name: "Passwort vergessen?" }).click();
  await expect(page).toHaveURL(/\/passwort-vergessen$/);
  await expect(page.getByRole("heading", { name: "Passwort vergessen" })).toBeVisible();
});

for (const fall of [
  { name: "Erfolg", status: 200, body: {} },
  { name: "Ratenlimit", status: 429, body: { code: "over_email_send_rate_limit", msg: "rate limit" } },
]) {
  test(`Reset-Anforderung zeigt bei ${fall.name} dieselbe neutrale Erfolgsseite`, async ({ page, auth }) => {
    auth.antworten.set("POST /recover", jsonAntwort(fall.status, fall.body));
    await page.goto("/passwort-vergessen");
    await page.getByLabel("E-Mail").fill(EMAIL);
    await page.getByRole("button", { name: "Link anfordern" }).click();

    await expect(page.getByRole("heading", { name: "Prüfe dein Postfach" })).toBeVisible();
    const recover = aufrufe(auth, "/recover");
    expect(recover).toHaveLength(1);
    expect(recover[0].methode).toBe("POST");
    expect(new URL(recover[0].url).searchParams.get("redirect_to")).toBe("http://localhost:3000/passwort-neu");
    expect(recover[0].body?.email).toBe(EMAIL);
  });
}

test("Netzfehler bei Reset-Anforderung zeigt Fehlerbanner", async ({ page, auth }) => {
  auth.antworten.set("POST /recover", (route) => route.abort().then(() => {}));
  await page.goto("/passwort-vergessen");
  await page.getByLabel("E-Mail").fill(EMAIL);
  await page.getByRole("button", { name: "Link anfordern" }).click();
  await expect(page.getByText(/konnte gerade nicht gesendet werden/)).toBeVisible();
  expect(aufrufe(auth, "/recover")).toHaveLength(1);
});

for (const pfad of [
  "/passwort-neu",
  "/passwort-neu#error=access_denied&error_code=otp_expired",
]) {
  test(`Reset-Link ohne gültigen Token zeigt kein Formular: ${pfad}`, async ({ page }) => {
    await page.goto(pfad);
    await expect(page.getByRole("heading", { name: "Link ungültig" })).toBeVisible();
    await expect(page.getByLabel("Neues Passwort", { exact: true })).toHaveCount(0);
  });
}

test("Recovery prüft erst beim Speichern und setzt ein starkes Passwort", async ({ page, auth }) => {
  auth.antworten.set("POST /verify", jsonAntwort(200, sitzung("email")));
  auth.antworten.set("PUT /user", jsonAntwort(200, sitzung("email").user));
  auth.antworten.set("POST /logout", jsonAntwort(200, {}));
  await page.goto("/passwort-neu?token_hash=abc&type=recovery");
  await expect(page.getByRole("heading", { name: "Neues Passwort" })).toBeVisible();
  expect(aufrufe(auth, "/verify")).toHaveLength(0);

  await neuesPasswortAusfuellen(page, "abc");
  await page.getByRole("button", { name: "Passwort speichern" }).click();
  await expect(page.getByText(/Passwort ist zu schwach/)).toBeVisible();
  expect(aufrufe(auth, "/verify")).toHaveLength(0);

  await neuesPasswortAusfuellen(page);
  await page.getByRole("button", { name: "Passwort speichern" }).click();
  await expect(page.getByRole("heading", { name: "Passwort gespeichert" })).toBeVisible();
  expect(aufrufe(auth, "/verify")).toHaveLength(1);
  expect(aufrufe(auth, "/verify")[0].body).toMatchObject({ token_hash: "abc", type: "recovery" });
  expect(aufrufe(auth, "/user")).toHaveLength(1);
  expect(aufrufe(auth, "/user")[0].body?.password).toBe(PASSWORT);
  expect(aufrufe(auth, "/logout")).toHaveLength(1);
  expect(new URL(aufrufe(auth, "/logout")[0].url).searchParams.get("scope")).toBe("others");
});

test("Abgelaufener Recovery-Token verhindert Passwortänderung", async ({ page, auth }) => {
  auth.antworten.set("POST /verify", jsonAntwort(403, { code: "otp_expired", msg: "expired" }));
  await page.goto("/passwort-neu?token_hash=abc&type=recovery");
  await neuesPasswortAusfuellen(page);
  expect(aufrufe(auth, "/verify")).toHaveLength(0);
  await page.getByRole("button", { name: "Passwort speichern" }).click();
  await expect(page.getByRole("heading", { name: "Link ungültig" })).toBeVisible();
  expect(aufrufe(auth, "/verify")).toHaveLength(1);
  expect(aufrufe(auth, "/user")).toHaveLength(0);
});

test("Google-Konto bekommt kein Website-Passwort", async ({ page, auth }) => {
  auth.antworten.set("POST /verify", jsonAntwort(200, sitzung("google")));
  auth.antworten.set("POST /logout", jsonAntwort(200, {}));
  await page.goto("/passwort-neu?token_hash=abc&type=recovery");
  await neuesPasswortAusfuellen(page);
  expect(aufrufe(auth, "/verify")).toHaveLength(0);
  await page.getByRole("button", { name: "Passwort speichern" }).click();
  await expect(page.getByRole("heading", { name: "Anmeldung über Google" })).toBeVisible();
  expect(aufrufe(auth, "/verify")).toHaveLength(1);
  expect(aufrufe(auth, "/user")).toHaveLength(0);
  expect(aufrufe(auth, "/logout")).toHaveLength(1);
  expect(new URL(aufrufe(auth, "/logout")[0].url).searchParams.get("scope")).toBe("local");
});

for (const marke of [
  { tenant: "fcb", pfad: "/confirm-email?token_hash=abc&type=signup", willkommen: "Willkommen beim FCB", akzent: "29 95 173" },
  { tenant: "jfg", pfad: "/confirm-email?token_hash=abc&type=signup&tenant=jfg", willkommen: "Willkommen bei der JFG", akzent: "204 31 31" },
]) {
  test(`Signup-Link wird erst per Klick bestätigt (${marke.tenant})`, async ({ page, auth }) => {
    auth.antworten.set("POST /verify", jsonAntwort(200, sitzung("email")));
    await page.goto(marke.pfad);
    await expect(page.locator("html")).toHaveAttribute("data-tenant", marke.tenant);
    expect(await page.locator("html").evaluate((element) => getComputedStyle(element).getPropertyValue("--color-accent").trim())).toBe(marke.akzent);
    await expect(page.getByRole("button", { name: "Jetzt bestätigen" })).toBeVisible();
    expect(aufrufe(auth, "/verify")).toHaveLength(0);
    await page.getByRole("button", { name: "Jetzt bestätigen" }).click();
    await expect(page.getByRole("heading", { name: marke.willkommen })).toBeVisible();
    expect(aufrufe(auth, "/verify")).toHaveLength(1);
    expect(aufrufe(auth, "/verify")[0].body).toMatchObject({ token_hash: "abc", type: "signup" });
  });
}

for (const fall of [
  { name: "Session", body: sitzung("email"), ueberschrift: "E-Mail geändert" },
  { name: "erste Bestätigung", body: { msg: "Confirmation link accepted. Please proceed to confirm link sent to the other email" }, ueberschrift: "Fast geschafft" },
]) {
  test(`E-Mail-Änderung mit ${fall.name} zeigt passenden Status`, async ({ page, auth }) => {
    auth.antworten.set("POST /verify", jsonAntwort(200, fall.body));
    await page.goto("/confirm-email?token_hash=abc&type=email_change");
    await expect(page.getByRole("button", { name: "Jetzt bestätigen" })).toBeVisible();
    expect(aufrufe(auth, "/verify")).toHaveLength(0);
    await page.getByRole("button", { name: "Jetzt bestätigen" }).click();
    await expect(page.getByRole("heading", { name: fall.ueberschrift })).toBeVisible();
    expect(aufrufe(auth, "/verify")).toHaveLength(1);
    expect(aufrufe(auth, "/verify")[0].body).toMatchObject({ token_hash: "abc", type: "email_change" });
  });
}

test("Bestätigungsseite ohne Token und Session zeigt ungültigen Link", async ({ page }) => {
  await page.goto("/confirm-email");
  await expect(page.getByRole("heading", { name: "Link ungültig" })).toBeVisible();
});
