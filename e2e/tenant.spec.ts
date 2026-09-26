import { test, expect, type Page } from "@playwright/test";
import { tenantAusHostname, istProduktionsHost } from "../src/lib/tenant";

// ──────────────────────────────────────────────
// Multi-Tenant-Smoke: derselbe Code, zwei Auftritte (FCB + JFG)
//
// Die JFG-Domain ist noch nicht registriert. Getestet wird deshalb über den
// Test-Override aus `src/proxy.ts`: `?tenant=jfg` schaltet den Auftritt um und
// setzt ein Cookie, damit die Folgenavigation im JFG-Auftritt bleibt.
// Auf echten Produktionsdomains ist dieser Override bewusst wirkungslos –
// dort entscheidet allein der Hostname.
// ──────────────────────────────────────────────

const CONSENT_KEY = "fcb_consent_v1";
const CONSENT_VALUE = JSON.stringify({ notwendig: true, externeInhalte: false });

// RGB-Kanäle der Marken-Akzente aus globals.css (--color-accent)
const AKZENT_FCB = "29 95 173"; // #1d5fad
const AKZENT_JFG = "204 31 31"; // #cc1f1f

/** Consent vorab setzen, damit der Cookie-Banner keine Klicks abfängt. */
async function seedConsent(page: Page) {
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: CONSENT_KEY, value: CONSENT_VALUE }
  );
}

/** Liest den aufgelösten Wert der Akzent-CSS-Variable von <html>. */
async function akzentVariable(page: Page): Promise<string> {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--color-accent")
      .trim()
  );
}

// Reine Funktionsprüfung der Hostname-Zuordnung – braucht keinen Browser,
// deckt aber die Fälle ab, die man über localhost nicht testen kann.
test.describe("Hostname-Zuordnung", () => {
  test("Produktionsdomains werden exakt zugeordnet", () => {
    expect(tenantAusHostname("www.fcbuku.de")).toBe("fcb");
    expect(tenantAusHostname("fcbuku.de")).toBe("fcb");
    expect(tenantAusHostname("FCBUKU.DE:443")).toBe("fcb");
    expect(tenantAusHostname("www.jfg-kunstadt-obermain.de")).toBe("jfg");
    expect(tenantAusHostname("jfg.fcbuku.de")).toBe("jfg");

    expect(istProduktionsHost("www.fcbuku.de")).toBe(true);
    expect(istProduktionsHost("localhost:3000")).toBe(false);
  });

  test("Preview-Hosts sind immer FCB – auch mit 'jfg' im Branchnamen", () => {
    // Regression: Vercel bildet Preview-Aliase aus dem Branchnamen. Eine
    // Substring-Heuristik hatte die komplette Preview des Branches
    // `feature/jfg-multi-tenant` auf den JFG-Auftritt geschaltet.
    expect(
      tenantAusHostname(
        "website-fcb-git-feature-jfg-multi-tenant-sptech-projects.vercel.app"
      )
    ).toBe("fcb");
    expect(tenantAusHostname("localhost:3000")).toBe("fcb");
    expect(tenantAusHostname(null)).toBe("fcb");
  });
});

test.describe("Tenant-Erkennung & Marken-Akzent", () => {
  test("ohne Override läuft der Auftritt als FCB", async ({ page }) => {
    await seedConsent(page);
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("data-tenant", "fcb");
    expect(await akzentVariable(page)).toBe(AKZENT_FCB);
    await expect(page.getByRole("banner")).toContainText("1. FC 1911 Burgkunstadt");
  });

  test("?tenant=jfg schaltet auf den JFG-Auftritt inkl. rotem Akzent", async ({
    page,
  }) => {
    await seedConsent(page);
    await page.goto("/?tenant=jfg");

    await expect(page.locator("html")).toHaveAttribute("data-tenant", "jfg");
    expect(await akzentVariable(page)).toBe(AKZENT_JFG);
    await expect(page.getByRole("banner")).toContainText("JFG Kunstadt-Obermain");
  });

  test("Override bleibt über die Folgenavigation erhalten (Cookie)", async ({
    page,
  }) => {
    await seedConsent(page);
    await page.goto("/?tenant=jfg");
    await expect(page.locator("html")).toHaveAttribute("data-tenant", "jfg");

    // Zweiter Aufruf OHNE Query-Parameter – das Cookie muss greifen
    await page.goto("/mannschaften");
    await expect(page.locator("html")).toHaveAttribute("data-tenant", "jfg");

    // Zurückschalten muss ebenso funktionieren
    await page.goto("/?tenant=fcb");
    await expect(page.locator("html")).toHaveAttribute("data-tenant", "fcb");
  });
});

test.describe("Navigation je Marke", () => {
  test("FCB-Navigation enthält Sportheim", async ({ page }) => {
    await seedConsent(page);
    await page.goto("/");

    const header = page.getByRole("banner");
    for (const label of ["Verein", "Mannschaften", "News", "Sportheim", "Kontakt"]) {
      await expect(header.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
  });

  test("JFG-Navigation zeigt kein Sportheim", async ({ page }) => {
    await seedConsent(page);
    await page.goto("/?tenant=jfg");

    const header = page.getByRole("banner");
    for (const label of ["Verein", "Mannschaften", "News", "Kontakt"]) {
      await expect(header.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await expect(header.getByRole("link", { name: "Sportheim", exact: true })).toHaveCount(0);
  });

  test("/sportheim ist auf dem JFG-Auftritt nicht erreichbar", async ({ page }) => {
    await seedConsent(page);
    // Erst den Override setzen, dann die FCB-exklusive Route direkt aufrufen
    await page.goto("/?tenant=jfg");
    const response = await page.goto("/sportheim");

    expect(response?.status()).toBe(404);
  });

  test("/sportheim bleibt auf dem FCB-Auftritt erreichbar", async ({ page }) => {
    await seedConsent(page);
    const response = await page.goto("/sportheim");

    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toContainText("Sportheim");

    // Farbe allein reicht für die Kategorien nicht: Die Legende muss die drei
    // Bedeutungen auch auf schmalen Viewports namentlich unterscheiden.
    const legende = page.getByRole("list", {
      name: "Kategorien im Belegungskalender",
    });
    await expect(legende.getByText("FCB-Heimspiel", { exact: true })).toBeVisible();
    await expect(legende.getByText("JFG-Heimspiel", { exact: true })).toBeVisible();
    await expect(legende.getByText("Belegung Sportheim", { exact: true })).toBeVisible();
  });
});

test.describe("Mannschaften je Marke", () => {
  test("JFG zeigt nur die Jugendmannschaften der JFG", async ({ page }) => {
    await seedConsent(page);
    await page.goto("/mannschaften?tenant=jfg");

    const main = page.locator("main");
    await expect(main).toContainText("A-Junioren");
    await expect(main).toContainText("D-Junioren");
    // Die Auswahl bleibt bei der Altersklasse – der BFV-Name steht erst auf
    // der Card (siehe Test "C-Junioren tragen ihren BFV-Namen").
    await expect(main).toContainText("C-Junioren");
    // FCB-eigene Teams dürfen auf dem JFG-Auftritt nicht auftauchen
    await expect(main).not.toContainText("1. Mannschaft");
    await expect(main).not.toContainText("G-Junioren");
  });

  test("C-Junioren tragen ihren BFV-Namen auf der Spielbetriebs-Card", async ({
    page,
  }) => {
    await seedConsent(page);
    await page.goto("/mannschaften?tenant=jfg");

    // Genau dieser Name muss auch an einer Sportheim-Sperre stehen, damit der
    // Slot eindeutig dieser Mannschaft zuzuordnen ist. Ohne die Kennung "C"
    // stünde dort nur "JFG Kunstadt-Obermain".
    await page
      .getByRole("group", { name: "Mannschaft wählen" })
      .getByRole("button", { name: "C-Junioren" })
      .click();

    await expect(page.locator("main")).toContainText("JFG Kunstadt-Obermain C");
  });

  test("FCB zeigt nur eigene Teams, keine JFG-Infos mehr (JFG hat eigene Domain)", async ({ page }) => {
    await seedConsent(page);
    await page.goto("/mannschaften");

    const main = page.locator("main");
    await expect(main).toContainText("1. Mannschaft");
    await expect(main).not.toContainText("A-Junioren");
  });
});

test.describe("Vereins-Switcher", () => {
  test("wechselt vom FCB auf die JFG-Domain", async ({ page }) => {
    await seedConsent(page);
    await page.goto("/verein");

    await page.getByRole("button", { name: "Verein wechseln" }).click();

    // Der Eintrag der anderen Marke ist ein echter Domainwechsel-Link
    const jfgLink = page.getByRole("link", { name: /JFG Kunstadt-Obermain/ });
    await expect(jfgLink).toBeVisible();
    // Zieldomain + inhaltlich passender Pfad (beide Auftritte haben /verein)
    await expect(jfgLink).toHaveAttribute(
      "href",
      /jfg-kunstadt-obermain\.de\/verein$/
    );
  });

  test("markiert auf dem JFG-Auftritt die JFG als aktiv", async ({ page }) => {
    await seedConsent(page);
    await page.goto("/verein?tenant=jfg");

    await page.getByRole("button", { name: "Verein wechseln" }).click();

    // Rückweg zum FCB ist ein Link auf die FCB-Domain
    const fcbLink = page.getByRole("link", { name: /1\. FC 1911 Burgkunstadt/ });
    await expect(fcbLink).toBeVisible();
    await expect(fcbLink).toHaveAttribute("href", /fcbuku\.de\/verein$/);
  });

  test("markenexklusiver Pfad fällt auf die Startseite der Zieldomain zurück", async ({
    page,
  }) => {
    await seedConsent(page);
    // /sportheim existiert nur beim FCB → Wechsel zur JFG landet auf "/"
    await page.goto("/sportheim");

    await page.getByRole("button", { name: "Verein wechseln" }).click();

    const jfgLink = page.getByRole("link", { name: /JFG Kunstadt-Obermain/ });
    await expect(jfgLink).toHaveAttribute("href", /jfg-kunstadt-obermain\.de\/$/);
  });
});

// Die Datenschutzerklärung ist eine gemeinsame Seite für beide Marken. Neue
// Pflichtabschnitte (hier: Leak-Check bei Registrierung/Passwort ändern) dürfen
// nicht versehentlich hinter eine Tenant-Bedingung rutschen.
test.describe("Datenschutz je Marke", () => {
  for (const tenant of ["fcb", "jfg"] as const) {
    test(`${tenant.toUpperCase()} erklärt die Passwort-Leak-Prüfung`, async ({ page }) => {
      await seedConsent(page);
      await page.goto(`/datenschutz?tenant=${tenant}`);

      await expect(page.locator("html")).toHaveAttribute("data-tenant", tenant);
      await expect(
        page.getByRole("heading", { name: /Prüfung auf unsichere Passwörter/ })
      ).toBeVisible();
      await expect(page.getByText(/k-Anonymity-Verfahren/)).toBeVisible();
    });
  }
});
