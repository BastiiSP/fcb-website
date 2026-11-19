import {
  beitrittstext,
  GLAEUBIGER_ID,
  KONTAKTANSCHRIFT,
  mandatstext,
  rollenLabel,
  signaturname,
  type Beitrittsdaten,
  type Beitrittsnachweise,
  type Signatur,
} from "./beitritt";
import { TENANTS } from "./tenant";

const RAND = 17;
const SPALTENABSTAND = 7;
const BILD_BREITE = 62;
const BILD_HOEHE = 25;
const BILDRAND = 2;
const DRUCKPIXEL_PRO_MM = 12;
const TEXTFARBE = 24;
const NEBENTEXT = 76;
const LINIENFARBE = 195;
const ABSCHNITTSHOEHE = 7;
const STANDARDZEICHEN = /^[\x20-\x7e\u00a0-\u00ff€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]*$/u;

interface Schrift {
  groesse: number;
  fett?: boolean;
}

interface Textzeilen {
  zeilen: string[];
  zeilenhoehe: number;
  schrift: Schrift;
  alsBild: boolean;
  breite: number;
}

type Dokumentart = "Beitrittsantrag" | "SEPA-Lastschriftmandat";

function lokalerZeitpunkt(zeitpunkt: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "long",
    timeZone: "Europe/Berlin",
  }).format(new Date(zeitpunkt));
}

function geburtstag(isoDatum: string) {
  const [jahr, monat, tag] = isoDatum.split("-");
  return `${tag}.${monat}.${jahr}`;
}

export async function beitrittsPdf(
  daten: Beitrittsdaten,
  nachweise: Beitrittsnachweise,
  vereinsname: string,
): Promise<void> {
  // Beim PDF-Export werden nur die Bibliothek und das öffentliche Vereinswappen geladen.
  const jfg = TENANTS.jfg;
  const [{ jsPDF }, wappenAntwort] = await Promise.all([
    import("jspdf"),
    fetch(jfg.logoPngSrc, { credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" }),
  ]);
  if (!wappenAntwort.ok) throw new Error("Das Vereinswappen konnte nicht geladen werden.");
  const wappen = new Uint8Array(await wappenAntwort.arrayBuffer());
  const pdf = new jsPDF({ format: "a4", unit: "mm", compress: true });
  const seitenBreite = pdf.internal.pageSize.getWidth();
  const seitenHoehe = pdf.internal.pageSize.getHeight();
  const breite = seitenBreite - 2 * RAND;
  const rechterRand = seitenBreite - RAND;
  const fusslinie = seitenHoehe - 17;
  const maxY = fusslinie - 6;
  const [rot, gruen, blau] = (
    getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim() || "76 76 76"
  ).split(/\s+/).map(Number);
  const { width: wappenBreite, height: wappenHoehe } = pdf.getImageProperties(wappen);
  const wappenMassstab = 23 / Math.max(wappenBreite, wappenHoehe);
  let dokumentart: Dokumentart = "Beitrittsantrag";
  let y = 0;
  let zeilenbild: HTMLCanvasElement | undefined;

  pdf.setProperties({
    title: "TEST – Beitrittsantrag und SEPA-Lastschriftmandat",
    subject: vereinsname,
  });

  function setzeSchrift({ groesse, fett }: Schrift) {
    pdf.setFont("helvetica", fett ? "bold" : "normal");
    pdf.setFontSize(groesse);
  }

  function bildkontext({ groesse, fett }: Schrift) {
    zeilenbild ??= document.createElement("canvas");
    const kontext = zeilenbild.getContext("2d");
    if (!kontext) throw new Error("Schriftbild für das PDF nicht verfügbar");
    const px = groesse * (25.4 / 72) * DRUCKPIXEL_PRO_MM;
    kontext.font = `${fett ? "bold" : "normal"} ${px}px sans-serif`;
    kontext.textBaseline = "top";
    return kontext;
  }

  function textzeilen(text: string, schrift: Schrift, verfuegbareBreite: number): Textzeilen {
    const wert = text.normalize("NFC").replace(/[^\S\n]+/g, " ");
    const alsBild = !STANDARDZEICHEN.test(wert.replace(/\n/g, ""));
    const zeilenhoehe = schrift.groesse * 0.46;
    if (!alsBild) {
      setzeSchrift(schrift);
      const zeilen: string[] = pdf.splitTextToSize(wert, verfuegbareBreite);
      return { zeilen, zeilenhoehe, schrift, alsBild, breite: verfuegbareBreite };
    }

    // Die PDF-Standardschrift deckt viele Alphabete nicht ab. Für diese
    // Eingaben rendert der Browser die Originalzeichen mit seinem Font-Fallback.
    const kontext = bildkontext(schrift);
    const maxBreite = verfuegbareBreite * DRUCKPIXEL_PRO_MM - 4;
    const zeilen: string[] = [];
    const grapheme = new Intl.Segmenter("de", { granularity: "grapheme" });
    for (const absatz of wert.split("\n")) {
      let zeile = "";
      for (const wort of absatz.trim().split(" ")) {
        const mitWort = zeile ? `${zeile} ${wort}` : wort;
        if (kontext.measureText(mitWort).width <= maxBreite) {
          zeile = mitWort;
          continue;
        }
        if (zeile) zeilen.push(zeile);
        zeile = "";
        for (const { segment } of grapheme.segment(wort)) {
          if (zeile && kontext.measureText(zeile + segment).width > maxBreite) {
            zeilen.push(zeile);
            zeile = "";
          }
          zeile += segment;
        }
      }
      zeilen.push(zeile);
    }
    return { zeilen, zeilenhoehe, schrift, alsBild, breite: verfuegbareBreite };
  }

  function druckeZeile(zeile: string, format: Textzeilen, x: number, oben: number) {
    if (!zeile) return;
    if (!format.alsBild) {
      setzeSchrift(format.schrift);
      pdf.text(zeile, x, oben, { baseline: "top" });
      return;
    }

    const gemessen = bildkontext(format.schrift).measureText(zeile).width;
    const canvas = zeilenbild!;
    canvas.width = Math.ceil(Math.min(gemessen + 4, format.breite * DRUCKPIXEL_PRO_MM));
    canvas.height = Math.ceil(format.zeilenhoehe * DRUCKPIXEL_PRO_MM);
    const kontext = bildkontext(format.schrift);
    kontext.fillStyle = "#000";
    kontext.fillText(zeile, 2, 2, canvas.width - 4);
    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      x,
      oben,
      canvas.width / DRUCKPIXEL_PRO_MM,
      canvas.height / DRUCKPIXEL_PRO_MM,
    );
  }

  function druckeText(format: Textzeilen, x: number, oben: number) {
    format.zeilen.forEach((zeile, index) => {
      druckeZeile(zeile, format, x, oben + format.zeilenhoehe * index);
    });
  }

  function spielfeld(x: number, oben: number) {
    pdf.setDrawColor(165);
    pdf.setLineWidth(0.22);
    pdf.rect(x, oben, 28, 17);
    pdf.line(x + 14, oben, x + 14, oben + 17);
    pdf.circle(x + 14, oben + 8.5, 3.2);
    pdf.rect(x, oben + 4.5, 5, 8);
    pdf.rect(x + 23, oben + 4.5, 5, 8);
  }

  function kopf() {
    pdf.setFillColor(rot, gruen, blau);
    pdf.rect(RAND, 13, breite, 1.15, "F");
    pdf.addImage(wappen, "PNG", RAND, 18, wappenBreite * wappenMassstab, wappenHoehe * wappenMassstab, "vereinswappen");

    const vereinsStart = RAND + 28;
    const spielfeldStart = rechterRand - 28;
    const vereinsbreite = spielfeldStart - vereinsStart - 6;
    spielfeld(spielfeldStart, 21);
    pdf.setTextColor(TEXTFARBE);
    setzeSchrift({ groesse: 14, fett: true });
    pdf.text(jfg.name.toLocaleUpperCase("de-DE"), vereinsStart, 20, { baseline: "top", charSpace: 0.24 });
    pdf.setTextColor(NEBENTEXT);
    const vereinszeilen = textzeilen(jfg.vereinsname, { groesse: 8.5 }, vereinsbreite);
    druckeText(vereinszeilen, vereinsStart, 27.6);
    const adresseOben = 28.5 + vereinszeilen.zeilen.length * vereinszeilen.zeilenhoehe;
    druckeText(textzeilen(KONTAKTANSCHRIFT, { groesse: 8.5 }, vereinsbreite), vereinsStart, adresseOben);

    pdf.setDrawColor(LINIENFARBE);
    pdf.line(RAND, 44, rechterRand, 44);
    pdf.setTextColor(TEXTFARBE);
    setzeSchrift({ groesse: 23, fett: true });
    pdf.text(dokumentart, RAND, 48, { baseline: "top" });

    const testhinweis = "TESTDOKUMENT – NICHT ZUR EINREICHUNG";
    setzeSchrift({ groesse: 8.5, fett: true });
    pdf.setFillColor("#f7f7f7");
    pdf.rect(RAND, 60, pdf.getTextWidth(testhinweis) + 8, 6.5, "F");
    pdf.setFillColor(rot, gruen, blau);
    pdf.rect(RAND, 60, 1, 6.5, "F");
    pdf.setTextColor(TEXTFARBE);
    pdf.text(testhinweis, RAND + 4, 61.7, { baseline: "top" });
    y = 73;
  }

  function seitenumbruch() {
    pdf.addPage();
    kopf();
  }

  function platzFuer(hoehe: number) {
    if (y + hoehe > maxY) seitenumbruch();
  }

  function abschnitt(titel: string, mindestplatz = 13) {
    platzFuer(ABSCHNITTSHOEHE + 3 + mindestplatz);
    pdf.setFillColor("#f6f6f6");
    pdf.rect(RAND, y, breite, ABSCHNITTSHOEHE, "F");
    pdf.setFillColor(rot, gruen, blau);
    pdf.rect(RAND, y, 1, ABSCHNITTSHOEHE, "F");
    pdf.setTextColor(TEXTFARBE);
    setzeSchrift({ groesse: 10.5, fett: true });
    pdf.text(titel, RAND + 4, y + 1.55, { baseline: "top" });
    y += ABSCHNITTSHOEHE + 3;
  }

  function felder(...paare: [label: string, wert: string | null][]) {
    const spaltenbreite = (breite - SPALTENABSTAND * (paare.length - 1)) / paare.length;
    const werte = paare.map(([label, wert], index) => ({
      label,
      x: RAND + index * (spaltenbreite + SPALTENABSTAND),
      format: wert === null ? null : textzeilen(wert.trim() || "–", { groesse: 10 }, spaltenbreite),
    }));
    const werthoehen = werte.map(({ format }) => format ? format.zeilen.length * format.zeilenhoehe : 7);
    const hoehe = Math.max(...werthoehen) + 8.5;
    platzFuer(hoehe);
    for (const { label, x, format } of werte) {
      pdf.setTextColor(NEBENTEXT);
      setzeSchrift({ groesse: 8, fett: true });
      pdf.text(label, x, y, { baseline: "top" });
      pdf.setTextColor(TEXTFARBE);
      if (format) {
        druckeText(format, x, y + 4);
      } else {
        // Die Vereinskasse kann die zugeteilte Referenz nach dem Druck eintragen.
        pdf.setDrawColor(128);
        pdf.line(x, y + 10, x + spaltenbreite, y + 10);
      }
    }
    if (werte.every(({ format }) => format !== null)) {
      pdf.setDrawColor(LINIENFARBE);
      pdf.line(RAND, y + hoehe - 2.2, rechterRand, y + hoehe - 2.2);
    }
    y += hoehe;
  }

  function absatz(text: string) {
    const einzugsbreite = 3;
    const format = textzeilen(text, { groesse: 10 }, breite - 2 * einzugsbreite);
    for (const zeile of format.zeilen) {
      platzFuer(format.zeilenhoehe);
      pdf.setTextColor(TEXTFARBE);
      druckeZeile(zeile, format, RAND + einzugsbreite, y);
      y += format.zeilenhoehe;
    }
    y += 5;
  }

  function unterschrift(signatur: Signatur | undefined) {
    if (!signatur) return;
    const bildrahmenBreite = BILD_BREITE + 2 * BILDRAND;
    const textbreite = breite - bildrahmenBreite - SPALTENABSTAND;
    const name = textzeilen(signatur.name, { groesse: 10, fett: true }, textbreite);
    const zeitUndOrt = textzeilen(
      `${signatur.ort}\n${lokalerZeitpunkt(signatur.zeitpunkt)}`,
      { groesse: 9 },
      textbreite,
    );
    const texthoehe = 7 + name.zeilen.length * name.zeilenhoehe;
    const bildrahmenHoehe = BILD_HOEHE + 2 * BILDRAND;
    const hoehe = Math.max(texthoehe + zeitUndOrt.zeilen.length * zeitUndOrt.zeilenhoehe, bildrahmenHoehe) + 5;
    platzFuer(hoehe);
    pdf.setTextColor(NEBENTEXT);
    setzeSchrift({ groesse: 8, fett: true });
    pdf.text(rollenLabel[signatur.rolle], RAND, y, { baseline: "top" });
    pdf.setTextColor(TEXTFARBE);
    druckeText(name, RAND, y + 5);
    druckeText(zeitUndOrt, RAND, y + texthoehe);

    const bildrahmenLinks = rechterRand - bildrahmenBreite;
    pdf.setDrawColor(LINIENFARBE);
    pdf.setLineWidth(0.22);
    pdf.rect(bildrahmenLinks, y, bildrahmenBreite, bildrahmenHoehe);
    const bild = pdf.getImageProperties(signatur.bild);
    const massstab = Math.min(BILD_BREITE / bild.width, BILD_HOEHE / bild.height);
    pdf.addImage(
      signatur.bild,
      "PNG",
      bildrahmenLinks + (bildrahmenBreite - bild.width * massstab) / 2,
      y + (bildrahmenHoehe - bild.height * massstab) / 2,
      bild.width * massstab,
      bild.height * massstab,
    );
    y += hoehe;
  }

  kopf();
  abschnitt("Angaben zum Mitglied");
  felder(["Vor- und Nachname", signaturname(daten, "mitglied")], ["Geburtsdatum", geburtstag(daten.geburtsdatum)]);
  felder(["Straße und Hausnummer", daten.strasse], ["Postleitzahl und Ort", `${daten.plz} ${daten.ort}`]);
  felder(["Telefon", daten.telefon], ["E-Mail", daten.email]);
  felder(["Stammverein", daten.stammverein], ["Gesetzliche Vertretung", daten.vertretung]);
  abschnitt("Antrag und Beitrag");
  absatz(beitrittstext(vereinsname));
  abschnitt("Unterschriften zum Beitritt", BILD_HOEHE + 2 * BILDRAND + 5);
  unterschrift(nachweise.mitglied);
  unterschrift(nachweise.vertretung);

  dokumentart = "SEPA-Lastschriftmandat";
  seitenumbruch();
  abschnitt("Angaben zum Mandat");
  felder(["Gläubiger-Identifikationsnummer", GLAEUBIGER_ID], ["Mandatsreferenz (durch Verein zu ergänzen)", null]);
  felder(["Zahlungsart", "Wiederkehrende Zahlung"], ["Mitglied", signaturname(daten, "mitglied")]);
  felder(["Kontoinhaber/in", daten.kontoinhaber]);
  felder(["IBAN", daten.iban], ["Kreditinstitut", daten.bank]);
  abschnitt("Erklärung");
  absatz(mandatstext(vereinsname));
  abschnitt("Unterschrift für das SEPA-Mandat", BILD_HOEHE + 2 * BILDRAND + 5);
  unterschrift(nachweise.kontoinhaber);

  const seitenzahl = pdf.getNumberOfPages();
  for (let seite = 1; seite <= seitenzahl; seite += 1) {
    pdf.setPage(seite);
    pdf.setDrawColor(LINIENFARBE);
    pdf.setLineWidth(0.22);
    pdf.line(RAND, fusslinie, rechterRand, fusslinie);
    pdf.setFillColor(rot, gruen, blau);
    pdf.rect(RAND, fusslinie, 12, 0.65, "F");
    setzeSchrift({ groesse: 8 });
    pdf.setTextColor(NEBENTEXT);
    pdf.text(jfg.domain, RAND, fusslinie + 3, { baseline: "top" });
    pdf.text(`Seite ${seite} von ${seitenzahl}`, rechterRand, fusslinie + 3, { align: "right", baseline: "top" });
  }

  pdf.save("TEST-Beitrittsantrag-und-SEPA-Mandat.pdf");
}
