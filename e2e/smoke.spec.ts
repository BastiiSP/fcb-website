import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { TENANTS } from "../src/lib/tenant";

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
  opts: { rolle: string }
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

// ──────────────────────────────────────────────
// 1. Öffentliche Routen laden fehlerfrei
// ──────────────────────────────────────────────
test.describe("Öffentliche Routen – Smoke", () => {
  const publicRoutes: { path: string; expectedContent: string }[] = [
    { path: "/", expectedContent: "FCB" },
    // h1 auf /login lautet "Willkommen zurück" – kein "Anmelden"-Text vorhanden
    { path: "/login", expectedContent: "Willkommen zurück" },
    { path: "/impressum", expectedContent: "Impressum" },
    { path: "/datenschutz", expectedContent: "Datenschutz" },
  ];

  for (const { path, expectedContent } of publicRoutes) {
    test(`${path} lädt und rendert ohne Console-Errors`, async ({ page }) => {
      // Konsolen-Fehler sammeln
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        // Bekannte harmlose Warnings herausfiltern:
        // - react-select aria-errormessage Hydration-Warning
        // - Next.js Dev-Overlay Meldungen
        if (
          text.includes("aria-errormessage") ||
          text.includes("ReactDOM.render") ||
          text.includes("Warning: ") ||
          text.includes("Download the React") ||
          text.includes("__NEXT_") ||
          text.includes("fast refresh")
        ) {
          return;
        }
        consoleErrors.push(text);
      });

      await seedStorage(page);
      await page.goto(path);

      // Seite hat Inhalt geladen
      await expect(page.locator("body")).toContainText(expectedContent);

      // Keine unerwarteten Konsolen-Fehler
      expect(
        consoleErrors,
        `Unerwartete Console-Errors auf ${path}: ${consoleErrors.join("; ")}`
      ).toHaveLength(0);
    });
  }
});

// ──────────────────────────────────────────────
// 2. Standard-Theme ist Dunkel
// ──────────────────────────────────────────────
test("Standard-Theme ist dark (kein localStorage)", async ({ browser }) => {
  // Frischer Kontext ohne jeglichen localStorage
  const context: BrowserContext = await browser.newContext();
  const page = await context.newPage();

  // Nur Consent setzen, kein Theme – so verhält sich ein Erstbesucher
  await page.addInitScript(
    ({ consentKey, consentValue }) => {
      localStorage.setItem(consentKey, consentValue);
    },
    { consentKey: CONSENT_KEY, consentValue: CONSENT_VALUE }
  );

  await page.goto("/");

  // Das FOUC-Script setzt „dark" als Default auf <html>
  const htmlEl = page.locator("html");
  await expect(htmlEl).toHaveClass(/dark/);

  await context.close();
});

// ──────────────────────────────────────────────
// 3. Theme-Toggle: Wechsel + Persistenz nach Reload
// ──────────────────────────────────────────────
test("Theme-Toggle wechselt auf light und bleibt nach Reload", async ({
  page,
}) => {
  // Consent setzen, kein Theme (startet im Dark-Default)
  await seedStorage(page);
  await page.goto("/impressum");

  // Sicherstellen, dass wir im dunklen Modus starten
  await expect(page.locator("html")).toHaveClass(/dark/);

  // Der ThemeToggle ist jetzt ein Switch (role="switch").
  // Im Dark-Modus ist aria-checked="true" (Dunkel ist aktiv/eingeschaltet).
  const toggle = page.locator('[role="switch"]').first();
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  await toggle.click();

  // Nach dem Klick: aria-checked flippt auf "false" (Dunkel ist deaktiviert = hell aktiv)
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  // html-Element muss jetzt "light" tragen
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  // localStorage muss aktualisiert sein
  const themeValue = await page.evaluate(
    (key: string) => localStorage.getItem(key),
    THEME_KEY
  );
  expect(themeValue).toBe("light");

  // Nach Reload: Theme bleibt "light", kein Dark-Flash
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

// ──────────────────────────────────────────────
// 4. Auth-Seite folgt dem Theme (kein Dark-Island mehr)
// ──────────────────────────────────────────────
test("Auth-Seite /login folgt dem globalen Theme (kein Dark-Island)", async ({
  page,
}) => {
  // Light-Modus erzwingen
  await seedStorage(page, { theme: "light" });
  await page.goto("/login");

  // Das globale html-Element ist "light" – und bleibt es auch auf der Auth-Seite
  await expect(page.locator("html")).toHaveClass(/light/);

  // Es gibt keinen .dark-Wrapper-Subtree mehr – Auth folgt dem globalen Theme
  const darkWrappers = page.locator(".dark");
  await expect(darkWrappers).toHaveCount(0);

  // Das Login-Formular ist sichtbar
  // h1 lautet "WILLKOMMEN ZURÜCK" (Oswald, uppercase) – enthält-Text-Prüfung
  await expect(page.locator("h1")).toContainText("Willkommen zurück");

  // Auf der Auth-Seite gibt es einen Theme-Switcher (role="switch")
  const themeSwitcher = page.locator('[role="switch"]').first();
  await expect(themeSwitcher).toBeVisible();
});

// ──────────────────────────────────────────────
// 5. Geschützte Routen leiten auf /login um (kein Crash)
// ──────────────────────────────────────────────
test.describe("Geschützte Routen – Redirect zu /login", () => {
  const gatedRoutes = ["/profil", "/mein-verein", "/vorstandsbereich", "/platzbuchung"];

  for (const path of gatedRoutes) {
    test(`${path} leitet aus (kein Server-Fehler)`, async ({ page }) => {
      await seedStorage(page);
      // Auf 'load' warten damit der DOM vollständig verfügbar ist
      const response = await page.goto(path, { waitUntil: "load" });

      // Kein 5xx-Fehler (Server-Crash) – Redirect (3xx→2xx) oder 200 ist ok
      const status = response?.status() ?? 0;
      expect(status, `${path} gab HTTP ${status} zurück`).toBeLessThan(500);

      // Nach Redirect ist die Seite geladen – body muss sichtbar sein
      await expect(page.locator("body")).toBeVisible();
    });
  }
});

// ──────────────────────────────────────────────
// 5b. Alte Routennamen leiten dauerhaft auf die neuen um (next.config.ts)
// ──────────────────────────────────────────────
test.describe("Alte Routen – Redirect auf neue Routennamen", () => {
  const umbenannteRouten = [
    { alt: "/kalender", neu: "/platzbuchung" },
    { alt: "/vorstand", neu: "/vorstandsbereich" },
  ];

  for (const { alt, neu } of umbenannteRouten) {
    test(`${alt} leitet auf ${neu} um`, async ({ page }) => {
      await seedStorage(page);
      await page.goto(alt, { waitUntil: "load" });

      // Nach dem Redirect landet die URL auf der neuen Route (Query/Hash ignorieren)
      expect(new URL(page.url()).pathname).toBe(neu);
    });
  }
});

// ──────────────────────────────────────────────
// 6. Rollen-Gates zeigen einheitliche Zugriffshinweise
// ──────────────────────────────────────────────
test.describe("Geschützte Routen – Rollen-Hinweise", () => {
  const freigabeRouten = ["/platzbuchung", "/vorstandsbereich", "/mitglieder", "/mein-verein"];

  for (const path of freigabeRouten) {
    test(`${path} zeigt für ausstehende Nutzer den Freigabe-Hinweis`, async ({
      page,
    }) => {
      await seedStorage(page);
      await mockEingeloggterNutzer(page, { rolle: "ausstehend" });

      await page.goto(path, { waitUntil: "load" });

      await expect(page.locator("body")).toContainText(
        "Dein Konto wartet noch auf Freigabe durch den Vorstand."
      );
      await expect(page.locator("body")).toContainText(
        "Sobald du freigeschaltet bist, hast du hier Zugriff."
      );
    });
  }

  for (const path of ["/platzbuchung", "/mitglieder"]) {
    test(`${path} zeigt für Mitglieder den Rollen-Hinweis statt Freigabe-Hinweis`, async ({
      page,
    }) => {
      await seedStorage(page);
      await mockEingeloggterNutzer(page, { rolle: "mitglied" });

      await page.goto(path, { waitUntil: "load" });

      await expect(page.locator("body")).toContainText(
        "Dieser Bereich ist für deine aktuelle Rolle (Mitglied) nicht vorgesehen."
      );
      await expect(page.locator("body")).toContainText("Zugriff haben:");
      await expect(page.locator("body")).not.toContainText(
        "wartet auf Freigabe"
      );
    });
  }

  test("/mein-verein zeigt für Mitglieder Inhalt statt Zugriffs-Hinweis", async ({
    page,
  }) => {
    await seedStorage(page);
    await mockEingeloggterNutzer(page, { rolle: "mitglied" });

    await page.goto("/mein-verein", { waitUntil: "load" });

    await expect(page.getByRole("heading", { name: "Mein Verein" })).toBeVisible();
    await expect(page.locator("body")).toContainText("WhatsApp-Gruppe");
    await expect(page.locator("body")).not.toContainText(
      "wartet noch auf Freigabe"
    );
    await expect(page.locator("body")).not.toContainText("nicht vorgesehen");
  });
});

// ──────────────────────────────────────────────
// 7. Account-Menü zeigt alle Rollenbereiche
// ──────────────────────────────────────────────
test("UserDropdown zeigt ausstehenden Nutzern alle Bereichslinks", async ({
  page,
}) => {
  await seedStorage(page);
  await mockEingeloggterNutzer(page, { rolle: "ausstehend" });

  await page.goto("/impressum", { waitUntil: "load" });

  await page.getByRole("button", { name: "BT" }).click();
  const menu = page.locator('[role="menu"]').first();
  await expect(menu).toBeVisible();

  for (const label of [
    "Platzbuchung",
    "Meine Buchungen",
    "Mitglieder",
    "Vorstandsbereich",
    "Mein Verein",
  ]) {
    // Headless UI rendert Menu.Item-Kinder mit role="menuitem", nicht "link"
    await expect(menu.getByRole("menuitem", { name: label })).toBeVisible();
  }
});

// ──────────────────────────────────────────────
// 8. Vereins-Switcher ist auf Mobile bedienbar
//
// Regressionstest zum Live-Fund vom 2026-07-30: Die rechte Header-Gruppe
// (Fanshop + Anmelden + Registrieren) drückte die linke Gruppe so weit
// zusammen, dass das Stadtwappen über dem Switcher-Chevron lag – der Wechsel
// FCB ↔ JFG war auf dem Handy nicht mehr möglich. Geprüft wird deshalb nicht
// nur „sichtbar", sondern dass der Chevron-Mittelpunkt tatsächlich den Trigger
// trifft (elementFromPoint) und ein echter Klick das Flyout öffnet.
// ──────────────────────────────────────────────
test.describe("Vereins-Switcher – Mobile", () => {
  // Gängige Gerätebreiten inkl. der schmalsten realistischen (iPhone SE 1. Gen)
  const breiten = [320, 375, 390, 414];

  for (const breite of breiten) {
    test(`bei ${breite} px klickbar und öffnet das Flyout`, async ({ page }) => {
      await seedStorage(page);
      await page.setViewportSize({ width: breite, height: 780 });
      await page.goto("/", { waitUntil: "load" });

      const trigger = page.getByRole("button", { name: /Verein wechseln/ });
      await expect(trigger).toBeVisible();

      // Kein anderes Element überlagert den Trigger-Mittelpunkt
      const frei = await trigger.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const oben = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return el === oben || el.contains(oben);
      });
      expect(frei, `Trigger bei ${breite} px überlagert`).toBe(true);

      // Header-Leiste läuft nicht über (Auslöser der Überlagerung)
      const overflow = await page
        .locator("header > div")
        .first()
        .evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow, `Header-Overflow bei ${breite} px`).toBeLessThanOrEqual(0);

      // Echter Klick öffnet das Flyout mit beiden Marken
      await trigger.click();
      await expect(page.getByText("Vereinsfamilie")).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Zu JFG Kunstadt-Obermain wechseln/ })
      ).toBeVisible();
    });
  }
});

// ──────────────────────────────────────────────
// 9. Fanshop bleibt erreichbar (aus dem Header in die Navigation gewandert)
// ──────────────────────────────────────────────
test("Fanshop steckt auf Mobile im Menü, auf Desktop in der Nav", async ({ page }) => {
  await seedStorage(page);

  // Mobile: nicht in der Header-Leiste, aber im Hamburger-Menü
  await page.setViewportSize({ width: 375, height: 780 });
  await page.goto("/", { waitUntil: "load" });
  await expect(page.getByRole("link", { name: "Fanshop" })).toBeHidden();
  await page.getByRole("button", { name: "Menü öffnen" }).click();
  await expect(page.getByRole("link", { name: "Fanshop" })).toBeVisible();

  // Desktop: direkt in der Navigationsleiste sichtbar
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/", { waitUntil: "load" });
  await expect(page.getByRole("link", { name: "Fanshop" })).toBeVisible();
});

// ──────────────────────────────────────────────
// 10. Favicon ist markenabhängig (JFG-Tab zeigte das FCB-Wappen)
// ──────────────────────────────────────────────
test.describe("Favicon pro Marke", () => {
  const faelle: { name: string; url: string; icon: string }[] = [
    { name: "FCB", url: "/", icon: "/favicon.ico" },
    // ?tenant=jfg ist der Test-Override des Proxys (nur Preview/localhost)
    { name: "JFG", url: "/?tenant=jfg", icon: "/favicon-jfg.ico" },
  ];

  for (const { name, url, icon } of faelle) {
    test(`${name}-Auftritt deklariert ${icon}`, async ({ page }) => {
      await seedStorage(page);
      await page.goto(url, { waitUntil: "load" });

      const iconHrefs = await page
        .locator('link[rel="icon"], link[rel="shortcut icon"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute("href")));

      expect(iconHrefs.length).toBeGreaterThan(0);
      for (const href of iconHrefs) {
        expect(href, `${name}: falsches Favicon deklariert`).toContain(icon);
      }

      // Datei existiert auch wirklich
      const antwort = await page.request.get(icon);
      expect(antwort.status()).toBe(200);
    });
  }
});

// ──────────────────────────────────────────────
// 11. Hero-Animation reagiert auf Touch (nicht nur auf die Maus)
//
// Fix zum Live-Fund vom 2026-07-30: Der Dot-Grid im Hero hing an `mousemove`
// und war auf Touch-Geräten damit komplett tot. Geprüft wird über eine
// Pixel-Signatur des Canvas: bewegt sich das Bild überhaupt?
// ──────────────────────────────────────────────
/** Signatur des Canvas-Inhalts (Alpha-Summe in Stichproben) – vergleichbar über Frames. */
function signatur() {
  const c = document.querySelector("section canvas") as HTMLCanvasElement | null;
  if (!c) return -1;
  const ctx = c.getContext("2d");
  if (!ctx) return -1;
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let s = 0;
  for (let i = 3; i < d.length; i += 4 * 97) s += d[i];
  return s;
}

test.describe("Hero-Canvas auf Touch", () => {
  // Nur die Emulationsfelder – der komplette Device-Descriptor würde webkit erzwingen
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });

  test("reagiert auf Touch-Gesten und lebt auch ohne Berührung", async ({ page }) => {
    await seedStorage(page);
    await page.goto("/", { waitUntil: "load" });

    // Gerät wird als Touch-Gerät erkannt (Grundlage für Ambient + Perf-Stufe)
    const grob = await page.evaluate(
      () => !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    );
    expect(grob, "Emulation liefert kein Touch-Profil").toBe(true);

    // 1. Ambient-Bewegung: ohne jede Eingabe verändert sich das Bild
    const a1 = await page.evaluate(signatur);
    await page.waitForTimeout(600);
    const a2 = await page.evaluate(signatur);
    expect(a1, "Ambient-Bewegung fehlt (Bild statisch)").not.toBe(a2);

    // 2. Touch-Reaktion: Tap + Wisch verschiebt die Dots messbar stärker
    const box = await page.locator("section canvas").boundingBox();
    if (!box) throw new Error("Canvas nicht gefunden");
    const mx = box.x + box.width / 2;
    const my = box.y + box.height / 2;

    const vorTouch = await page.evaluate(signatur);
    await page.evaluate(
      ({ x, y }) => {
        const opts = (cx: number, cy: number) => ({
          bubbles: true,
          clientX: cx,
          clientY: cy,
          pointerType: "touch",
          isPrimary: true,
        });
        window.dispatchEvent(new PointerEvent("pointerdown", opts(x, y)));
        for (let i = 0; i < 10; i++) {
          window.dispatchEvent(new PointerEvent("pointermove", opts(x + i * 6, y + i * 3)));
        }
      },
      { x: mx, y: my }
    );
    await page.waitForTimeout(120);
    const nachTouch = await page.evaluate(signatur);
    expect(nachTouch, "Touch bewegt die Dots nicht").not.toBe(vorTouch);

    // 3. Scrollen bleibt möglich (Listener sind passiv, kein preventDefault)
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

    // 4. Loop stoppt, wenn der Hero aus dem Viewport ist (Akkuschutz):
    //    zwei Messungen im Abstand müssen identisch sein
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    const w1 = await page.evaluate(signatur);
    await page.waitForTimeout(500);
    const w2 = await page.evaluate(signatur);
    expect(w1, "Loop läuft weiter, obwohl der Hero nicht sichtbar ist").toBe(w2);
  });
});

test.describe("Hero-Canvas mit Maus", () => {
  test("reagiert weiterhin auf Mausbewegung", async ({ page }) => {
    await seedStorage(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/", { waitUntil: "load" });

    const vor = await page.evaluate(signatur);
    await page.mouse.move(640, 400);
    await page.mouse.move(700, 430);
    await page.waitForTimeout(120);
    const nach = await page.evaluate(signatur);
    expect(nach, "Maus bewegt die Dots nicht mehr").not.toBe(vor);
  });
});

test.describe("Hero-Canvas bei reduzierter Bewegung", () => {
  test("bleibt statisch", async ({ page }) => {
    await seedStorage(page);
    // page.emulateMedia statt test.use({ reducedMotion }) – letzteres ist in der
    // installierten Playwright-Typversion auf Describe-Ebene nicht typisiert.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/", { waitUntil: "load" });

    // Erst warten, bis der einmalige Frame gezeichnet ist (Effekt läuft nach der
    // Hydration, direkt nach 'load' ist der Canvas noch leer).
    await expect.poll(() => page.evaluate(signatur)).toBeGreaterThan(0);
    const a = await page.evaluate(signatur);
    await page.waitForTimeout(600);
    const b = await page.evaluate(signatur);
    expect(a, "Trotz prefers-reduced-motion animiert").toBe(b);
  });
});

// ──────────────────────────────────────────────
// 12. Rotierendes Hero-Wort bleibt auf Mobile vollständig lesbar
//
// Live-Fund 2026-07-30: Bei ~375 px wurde das Wort rechts abgeschnitten
// ("ZUSAMMENHALT" → "ZUSAMMENHA"). Ursache: Die Slide-Animation braucht
// overflow-hidden, und das setzt die automatische Mindestbreite eines
// Flex-Items auf 0 – die Box schrumpfte unter die Wortbreite.
//
// Der Test läuft datengetrieben über die echten Wortlisten aus tenant.ts,
// damit ein künftig ergänztes (längeres) Wort automatisch mitgeprüft wird.
// Geprüft wird dreifach: nicht geclippt, nicht über den Viewport hinaus, und
// gleiche Zeilenhöhe für alle Wörter (sonst springt der Hero beim Wechsel).
// ──────────────────────────────────────────────
test.describe("Hero – rotierendes Wort auf Mobile", () => {
  const BREITEN = [320, 360, 375, 390, 414];

  for (const tenant of [TENANTS.fcb, TENANTS.jfg]) {
    test(`${tenant.kurzname}: jedes Wort vollständig sichtbar`, async ({ page }) => {
      await seedStorage(page);

      for (const breite of BREITEN) {
        await page.setViewportSize({ width: breite, height: 820 });
        await page.goto(`/?tenant=${tenant.id}`, { waitUntil: "load" });

        // Erst nach der Hydration ins DOM schreiben: 'load' kommt im Dev-Modus oft
        // vor der Hydration. Setzt der Test das Wort vorher, findet React fremden
        // Text im Server-HTML und wirft "Hydration failed" (Ursache der beiden
        // Warnungen pro Testlauf, geklärt 2026-09-25). React hängt beim Hydrieren
        // ein __reactFiber$…-Property an den Knoten – das ist das Signal.
        await page.waitForFunction(() => {
          const p = [...document.querySelectorAll("p")].find((el) =>
            el.textContent?.includes("Dein Verein für")
          );
          const wortSpan = p?.querySelector("span:last-child span");
          return (
            !!wortSpan && Object.keys(wortSpan).some((k) => k.startsWith("__reactFiber"))
          );
        });

        const hoehen: number[] = [];
        for (const wort of tenant.heroWords) {
          const m = await page.evaluate((w) => {
            const p = [...document.querySelectorAll("p")].find((el) =>
              el.textContent?.includes("Dein Verein für")
            ) as HTMLElement | undefined;
            if (!p) return null;
            // Letztes Kind ist die clippende Box des RotatingText
            const box = p.querySelector("span:last-child") as HTMLElement;
            const wortSpan = box.querySelector("span") as HTMLElement;
            // Wort setzen statt auf die Rotation zu warten (deterministisch)
            wortSpan.textContent = w;
            const br = box.getBoundingClientRect();
            const wr = wortSpan.getBoundingClientRect();
            return {
              geclippt: wr.width > br.width + 1 || wortSpan.scrollWidth > br.width + 1,
              rechterRand: Math.round(wr.right),
              linkerRand: Math.round(wr.left),
              hoehe: Math.round(p.getBoundingClientRect().height),
              viewport: window.innerWidth,
            };
          }, wort);

          expect(m, "Subheadline nicht gefunden").not.toBeNull();
          if (!m) continue;

          expect(m.geclippt, `${tenant.kurzname} @ ${breite}px: "${w(wort)}" abgeschnitten`).toBe(
            false
          );
          expect(
            m.rechterRand,
            `${tenant.kurzname} @ ${breite}px: "${w(wort)}" ragt über den Viewport`
          ).toBeLessThanOrEqual(m.viewport);
          expect(
            m.linkerRand,
            `${tenant.kurzname} @ ${breite}px: "${w(wort)}" ragt links raus`
          ).toBeGreaterThanOrEqual(0);
          hoehen.push(m.hoehe);
        }

        // Alle Wörter derselben Breite müssen gleich hoch bauen – sonst springt
        // der Hero bei jedem Wortwechsel vertikal.
        expect(
          new Set(hoehen).size,
          `${tenant.kurzname} @ ${breite}px: Zeilenhöhe wechselt je Wort (${hoehen.join("/")})`
        ).toBe(1);
      }
    });
  }
});

/** Nur zur Lesbarkeit der Fehlermeldungen (Wort in Großbuchstaben wie gerendert). */
function w(wort: string): string {
  return wort.toUpperCase();
}

// ──────────────────────────────────────────────
// 13. Hero-Headline bleibt auf schmalen Screens im Inhaltsbereich
//
// Die Headline hat eine feste Zeile („BURGKUNSTADT."), die nicht umbrechen kann –
// wird die Schrift zu groß für den Viewport, läuft sie aus dem Container und die
// Section (overflow-hidden) schneidet sie ab. Die untere clamp-Grenze skaliert
// deshalb unter 320 px mit der Breite; dieser Test hält das fest, inklusive der
// ultraschmalen Fälle (280 px = Galaxy Fold außen).
//
// Zusätzlich für beide Marken: der Hero-Inhalt ragt nirgends seitlich heraus.
// ──────────────────────────────────────────────
test.describe("Hero-Headline – schmale Screens", () => {
  const BREITEN = [280, 300, 320, 360, 375, 414];

  test("FCB-Headline bleibt innerhalb des Inhaltsbereichs", async ({ page }) => {
    await seedStorage(page);

    for (const breite of BREITEN) {
      await page.setViewportSize({ width: breite, height: 820 });
      await page.goto("/?tenant=fcb", { waitUntil: "load" });
      // Oswald per next/font mit font-display: swap – ohne dieses Warten misst
      // man die Fallback-Schrift und damit falsche Breiten.
      await page.evaluate(() => document.fonts.ready);

      const m = await page.evaluate(() => {
        const h1 = document.querySelector("h1") as HTMLElement;
        const container = h1.parentElement as HTMLElement;
        const cs = getComputedStyle(container);
        const cr = container.getBoundingClientRect();
        const innenLinks = cr.left + parseFloat(cs.paddingLeft);
        const innenRechts = cr.right - parseFloat(cs.paddingRight);
        const zeilen = [...h1.children].map((c) => {
          const r = c.getBoundingClientRect();
          return { text: c.textContent ?? "", links: r.left, rechts: r.right };
        });
        return {
          innenLinks: Math.round(innenLinks),
          innenRechts: Math.round(innenRechts),
          ueberstand: Math.max(
            ...zeilen.map((z) => Math.max(z.rechts - innenRechts, innenLinks - z.links))
          ),
          breiteste: zeilen.reduce((a, b) => (b.rechts - b.links > a.rechts - a.links ? b : a)),
        };
      });

      expect(
        Math.round(m.ueberstand),
        `Headline ragt bei ${breite}px um ${Math.round(m.ueberstand)}px aus dem Inhaltsbereich ("${m.breiteste.text}")`
      ).toBeLessThanOrEqual(0);
    }
  });

  for (const id of ["fcb", "jfg"] as const) {
    test(`${id.toUpperCase()}: Hero erzeugt bei 320 px keinen Seitwärts-Overflow`, async ({
      page,
    }) => {
      await seedStorage(page);
      await page.setViewportSize({ width: 320, height: 820 });
      await page.goto(`/?tenant=${id}`, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);

      const overflow = await page.evaluate(() => {
        const inhalt = document.querySelector("section > div.relative") as HTMLElement;
        return inhalt ? inhalt.scrollWidth - inhalt.clientWidth : 0;
      });
      expect(overflow, `Hero-Inhalt läuft bei 320px um ${overflow}px über`).toBeLessThanOrEqual(0);
    });
  }
});
