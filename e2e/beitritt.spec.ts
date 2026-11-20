import { test, expect, type Locator, type Page } from "@playwright/test";

const PFAD = "/beitritt/vereinsaufnahme";
const TEST_IBAN = "DE36 0000 0000 0000 0000 00";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fcb_consent_v1", JSON.stringify({ notwendig: true, externeInhalte: false }));
  });
});

async function datenEingeben(page: Page, minderjaehrig: boolean) {
  const feldwerte: Record<string, string> = {
    Vorname: "Jona", Nachname: "Formulartest", "Straße und Hausnummer": "Testweg 1",
    PLZ: "99999", Ort: "Teststadt", Geburtsdatum: minderjaehrig ? "2015-04-05" : "1990-04-05",
    Telefon: "00000000", "E-Mail": "formular@example.invalid",
    "Vor- und Nachname des Kontoinhabers": "Kim Formulartest",
    IBAN: TEST_IBAN, "Name der Bank": "Musterbank", "Ort für die Unterschriften": "Teststadt",
  };
  for (const [label, wert] of Object.entries(feldwerte)) {
    await page.getByLabel(label, { exact: true }).fill(wert);
  }
  await page.getByLabel("Stammverein", { exact: true }).selectOption({ label: "SG Roth-Main e.V." });
  const vertretung = page.getByLabel("Vor- und Nachname der gesetzlichen Vertretung");
  if (minderjaehrig) await vertretung.fill("Lou Formulartest");
  else await expect(vertretung).toHaveCount(0);
}

function weiterZuUnterschriften(page: Page) {
  return page.getByRole("button", { name: /Weiter zu den Unterschriften/ }).click();
}

async function zeichnen(page: Page) {
  await page.getByRole("button", { name: /^Unterschreiben\b/ }).click();
  const flaeche = page.getByRole("img", { name: "Zeichenfläche für die Unterschrift" });
  await flaeche.scrollIntoViewIfNeeded();
  const box = await flaeche.boundingBox();
  if (!box) throw new Error("Zeichenfläche fehlt");
  await page.mouse.move(box.x + 20, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 37, box.y + 15, { steps: 4 });
  await page.mouse.move(box.x + 58, box.y + 38, { steps: 4 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Unterschrift übernehmen", exact: true }).click();
  await page.getByRole("button", { name: "Unterschrift bestätigen", exact: true }).click();
}

async function signaturpunkte(bild: Locator, xAnteile: number[]) {
  return bild.evaluate(async (element, anteile) => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 240;
    const kontext = canvas.getContext("2d");
    if (!kontext) throw new Error("Canvas-Kontext fehlt");

    // SVG und PNG gleich prüfen, auch wenn sich die SVG-Elemente ändern.
    const quelle = new Image();
    if (element instanceof SVGSVGElement) {
      const svg = element.cloneNode(true) as SVGSVGElement;
      svg.setAttribute("width", String(canvas.width));
      svg.setAttribute("height", String(canvas.height));
      quelle.src = "data:image/svg+xml," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    } else if (element instanceof HTMLImageElement) {
      quelle.src = element.src;
    } else {
      throw new Error("Signaturbild fehlt");
    }
    await quelle.decode();
    kontext.drawImage(quelle, 0, 0, canvas.width, canvas.height);

    return anteile.map((anteil) => {
      const x = Math.round(anteil * canvas.width);
      const pixel = kontext.getImageData(x - 3, canvas.height / 2 - 4, 7, 8).data;
      return pixel.some((wert, index) => index % 4 === 3 && wert > 100);
    });
  }, xAnteile);
}

test("FCB liefert für den direkten Aufruf eine 404", async ({ page }) => {
  const antwort = await page.goto(PFAD + "?tenant=fcb");
  expect(antwort?.status()).toBe(404);
  await expect(page.getByLabel("IBAN", { exact: true })).toHaveCount(0);
});

test("IBAN bleibt beim Tippen, Einfügen und Korrigieren in Vierergruppen", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(PFAD + "?tenant=jfg");
  const iban = page.getByLabel("IBAN", { exact: true });
  await iban.pressSequentially("de3612345678");
  await expect(iban).toHaveValue("DE36 1234 5678");

  async function cursorSetzen(start: number, ende = start) {
    await iban.evaluate((feld, auswahl) => {
      (feld as HTMLInputElement).setSelectionRange(auswahl.start, auswahl.ende);
    }, { start, ende });
  }

  // Leerzeichen sind Anzeige. An der Gruppengrenze muss sich die Ziffer löschen lassen.
  await cursorSetzen(5);
  await iban.press("Backspace");
  await expect(iban).toHaveValue("DE31 2345 678");

  await iban.fill("DE36 1234 5678");
  await cursorSetzen(4);
  await iban.press("Delete");
  await expect(iban).toHaveValue("DE36 2345 678");

  await iban.fill("DE36 1234 5678");
  await cursorSetzen(3, 6);
  await iban.pressSequentially("98");
  await expect(iban).toHaveValue("DE39 8234 5678");

  await page.evaluate(() => navigator.clipboard.writeText("de36 0000\n0000 0000 0000 00"));
  await iban.selectText();
  await iban.press("ControlOrMeta+V");
  await expect(iban).toHaveValue(TEST_IBAN);
});

test("IBAN meldet Länge, Format und Prüfziffer und akzeptiert ein AT-Testkonto", async ({ page }) => {
  await page.goto(PFAD + "?tenant=jfg");
  await datenEingeben(page, false);
  const iban = page.getByLabel("IBAN", { exact: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await iban.fill("de36000000000000000");
  await expect(page.getByText("Noch 3 Ziffern")).toBeVisible();
  await expect(iban).not.toHaveAttribute("aria-invalid", "true");
  await weiterZuUnterschriften(page);
  await expect(iban).toHaveAttribute("aria-invalid", "true");
  await expect(iban).toBeFocused();

  await iban.fill("DE36 0A00 0000 0000 0000 00");
  await expect(page.getByText("Nach DE sind nur Ziffern erlaubt.")).toBeVisible();
  await expect(iban).toHaveAttribute("aria-invalid", "true");

  await iban.fill("DE36 0000 0000 0000 0000 01");
  await expect(page.getByText("Bitte vergleiche die IBAN noch einmal mit deiner Vorlage.")).toBeVisible();
  await expect(iban).toHaveAttribute("aria-invalid", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await iban.fill(TEST_IBAN);
  await expect(page.getByText("IBAN formal gültig")).toBeVisible();
  await expect(iban).not.toHaveAttribute("aria-invalid", "true");

  await iban.fill("at18 0000 0000 0000 0000");
  await expect(iban).toHaveValue("AT18 0000 0000 0000 0000");
  await iban.press("Tab");
  await expect(page.getByText("IBAN-Prüfsumme stimmt")).toBeVisible();
  await weiterZuUnterschriften(page);
  await expect(page.getByRole("heading", { name: "Beitrittserklärung unterschreiben" })).toBeVisible();
});

test("PLZ und E-Mail melden Fehler beim Verlassen und Weiter fokussiert den ersten Fehler", async ({ page }) => {
  await page.goto(PFAD + "?tenant=jfg");
  await datenEingeben(page, false);
  const plz = page.getByLabel("PLZ", { exact: true });
  const email = page.getByLabel("E-Mail", { exact: true });

  await plz.fill("012");
  await expect(plz).not.toHaveAttribute("aria-invalid", "true");
  await plz.press("Tab");
  await expect(plz).toHaveAttribute("aria-invalid", "true");
  await expect(plz).toHaveAccessibleDescription(/fünfstellige PLZ/);

  await email.fill("formular@example");
  await expect(email).not.toHaveAttribute("aria-invalid", "true");
  await email.press("Tab");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAccessibleDescription(/gültige E-Mail-Adresse/);

  await weiterZuUnterschriften(page);
  await expect(plz).toBeFocused();
  await plz.fill("01234");
  await plz.press("Tab");
  await expect(plz).toHaveValue("01234");
  await expect(plz).not.toHaveAttribute("aria-invalid", "true");

  await weiterZuUnterschriften(page);
  await expect(email).toBeFocused();
  await email.fill("formular@example.invalid");
  await email.press("Tab");
  await expect(email).not.toHaveAttribute("aria-invalid", "true");
  await weiterZuUnterschriften(page);
  await expect(page.getByRole("heading", { name: "Beitrittserklärung unterschreiben" })).toBeVisible();
});

test("Geburtsdatum in der Zukunft lässt sich nach dem Feldhinweis korrigieren", async ({ page }) => {
  await page.goto(PFAD + "?tenant=jfg");
  const datum = page.getByLabel("Geburtsdatum", { exact: true });
  await datum.fill("2099-04-05");
  await page.getByLabel("Telefon", { exact: true }).click();
  await expect(datum).toHaveAccessibleDescription(/gültiges Geburtsdatum bis einschließlich heute/);
  await expect(datum).toHaveAttribute("aria-invalid", "true");
  await datum.fill("1990-04-05");
  await expect(datum).not.toHaveAttribute("aria-invalid", "true");
});

test("volljähriges Mitglied und Kontoinhaber unterschreiben separat", async ({ page }) => {
  const antwort = await page.goto(PFAD + "?tenant=jfg");
  expect(antwort?.status()).toBe(200);
  expect(antwort?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.locator("html")).toHaveAttribute("data-tenant", "jfg");
  await datenEingeben(page, false);
  await weiterZuUnterschriften(page);
  await zeichnen(page);
  await expect(page.getByRole("heading", { name: "SEPA-Lastschriftmandat unterschreiben" })).toBeVisible();
  await zeichnen(page);
  await expect(page.getByRole("button", { name: "PDF herunterladen" })).toBeEnabled();
});

test.describe("Punkte und kurze Unterschriftsstriche", () => {
  test.use({ hasTouch: true });

  test("Mauspunkt, Fingertipp und schnelle Striche bleiben einzeln im Zeichenfeld und im PNG sichtbar", async ({ page }) => {
    await page.goto(PFAD + "?tenant=jfg");
    await datenEingeben(page, false);
    await weiterZuUnterschriften(page);
    await page.getByRole("button", { name: /^Unterschreiben\b/ }).click();
    const flaeche = page.getByRole("img", { name: "Zeichenfläche für die Unterschrift" });
    await flaeche.scrollIntoViewIfNeeded();
    const box = await flaeche.boundingBox();
    if (!box) throw new Error("Zeichenfläche fehlt");

    const x = (anteil: number) => box.x + box.width * anteil;
    const y = box.y + box.height / 2;
    await page.mouse.click(x(0.15), y);
    await page.touchscreen.tap(x(0.3), y);
    // Ein einzelnes Bewegungsereignis je Strich, deutlich unter der alten Mindestlänge.
    for (const anteil of [0.6, 0.8]) {
      await page.mouse.move(x(anteil), y);
      await page.mouse.down();
      await page.mouse.move(x(anteil + 4 / 600), y);
      await page.mouse.up();
    }

    const stellen = [0.15, 0.225, 0.3, 0.45, 0.6, 0.7, 0.8];
    const erwartet = [true, false, true, false, true, false, true];
    await expect.poll(() => signaturpunkte(flaeche, stellen)).toEqual(erwartet);
    await page.getByRole("button", { name: "Unterschrift übernehmen", exact: true }).click();
    const png = page.getByRole("img", { name: /^Übernommene Unterschrift/ });
    await expect(png).toHaveAttribute("src", /^data:image\/png;base64,/);
    expect(await signaturpunkte(png, stellen)).toEqual(erwartet);
  });
});

test("Namenseingabe nutzt lokal geladene Handschrift im Feld und im Druckbild", async ({ page }) => {
  const schriftdateien: string[] = [];
  page.on("response", (antwort) => {
    if (antwort.request().resourceType() === "font" && antwort.ok()) schriftdateien.push(antwort.url());
  });
  const textausgabe: { text: string; schrift: string }[] = [];
  await page.exposeFunction("protokolliereSignaturtext", (text: string, schrift: string) => {
    textausgabe.push({ text, schrift });
  });
  await page.addInitScript(() => {
    const protokoll = window as typeof window & { protokolliereSignaturtext: (text: string, schrift: string) => void };
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...argumente) {
      protokoll.protokolliereSignaturtext(argumente[0], this.font);
      fillText.apply(this, argumente);
    };
  });

  await page.goto(PFAD + "?tenant=jfg");
  await datenEingeben(page, false);
  await weiterZuUnterschriften(page);
  await page.getByRole("button", { name: /^Unterschreiben\b/ }).click();
  await page.getByRole("button", { name: "Namen eingeben", exact: true }).click();
  const namensfeld = page.getByRole("textbox", { name: "Vollständiger Name" });
  const name = "Jona Formulartest";
  await namensfeld.fill(name);
  await expect(namensfeld).toHaveCSS("font-family", /Allura/i);
  const handschrift = await namensfeld.evaluate((feld) =>
    getComputedStyle(feld).fontFamily.split(",")[0].trim().replace(/^['"]|['"]$/g, "")
  );
  expect(handschrift).toMatch(/Allura/i);
  await expect.poll(() => page.evaluate((familie) =>
    Array.from(document.fonts).some((schrift) => schrift.family === familie && schrift.status === "loaded"),
    handschrift
  )).toBe(true);
  expect(schriftdateien.length).toBeGreaterThan(0);
  expect(schriftdateien.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true);

  await page.getByRole("button", { name: "Unterschrift übernehmen", exact: true }).click();
  await expect(page.getByRole("img", { name: /^Übernommene Unterschrift/ }))
    .toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect.poll(() => textausgabe).toEqual(expect.arrayContaining([
    expect.objectContaining({ text: "Unterschrift per Namenseingabe" }),
    expect.objectContaining({ text: name, schrift: expect.stringContaining(handschrift) }),
  ]));
});

test("Minderjährige auf dem Handy: drei Nachweise, Korrektur und lokaler PDF-Download", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(PFAD + "?tenant=jfg");
  await page.getByRole("switch", { name: "Zu hellem Design wechseln" }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const uebermittelteDaten: string[] = [];
  page.on("request", (req) => {
    if (/Formulartest|example\.invalid|000000000000000000/i.test(req.url() + (req.postData() ?? ""))) {
      uebermittelteDaten.push(req.method());
    }
  });
  await datenEingeben(page, true);
  await weiterZuUnterschriften(page);
  await zeichnen(page);
  await expect(page.getByRole("heading", { name: "Als gesetzliche Vertretung unterschreiben" })).toBeVisible();
  await zeichnen(page);
  await zeichnen(page);
  await expect(page.getByRole("list", { name: "Bestätigte Unterschriften" }).getByRole("listitem")).toHaveCount(3);

  await page.getByRole("button", { name: "Daten bearbeiten" }).click();
  const bank = page.getByLabel("Name der Bank");
  await bank.fill("Änderung");
  await bank.fill("Musterbank");
  await weiterZuUnterschriften(page);
  await expect(page.getByRole("heading", { name: "SEPA-Lastschriftmandat unterschreiben" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Unterschrift bestätigen" })).toBeDisabled();
  await zeichnen(page);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF herunterladen" }).click();
  const pdf = await download;
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/i);
  expect(await pdf.failure()).toBeNull();
  await page.getByRole("button", { name: "Neu beginnen" }).click();
  await page.getByRole("button", { name: "Entwurf verwerfen" }).click();
  await expect(page.getByLabel("Vorname", { exact: true })).toHaveValue("");
  expect(uebermittelteDaten).toEqual([]);
});
