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

const RAND = 18;
const SPALTENABSTAND = 7;
const BILD_BREITE = 62;
const BILD_HOEHE = 25;
const DRUCKPIXEL_PRO_MM = 12;
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
  // Die Bibliothek wird erst zum Export aus der eigenen App geladen.
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ format: "a4", unit: "mm", compress: true });
  const seitenBreite = pdf.internal.pageSize.getWidth();
  const seitenHoehe = pdf.internal.pageSize.getHeight();
  const breite = seitenBreite - 2 * RAND;
  const maxY = seitenHoehe - RAND;
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

  function kopf() {
    pdf.setTextColor(145, 25, 25);
    setzeSchrift({ groesse: 10, fett: true });
    pdf.text("TESTDOKUMENT – NICHT ZUR EINREICHUNG", RAND, 16, { baseline: "top" });
    pdf.setDrawColor(190);
    pdf.setLineWidth(0.24);
    pdf.line(RAND, 23, seitenBreite - RAND, 23);
    pdf.setTextColor(0);
    setzeSchrift({ groesse: 20, fett: true });
    pdf.text(dokumentart, RAND, 28, { baseline: "top" });

    const verein = textzeilen(vereinsname, { groesse: 11, fett: true }, breite);
    druckeText(verein, RAND, 39);
    const adresseOben = 39 + verein.zeilen.length * verein.zeilenhoehe;
    druckeText(textzeilen(KONTAKTANSCHRIFT, { groesse: 9 }, breite), RAND, adresseOben + 1);
    y = adresseOben + 11;
  }

  function seitenumbruch() {
    pdf.addPage();
    kopf();
  }

  function platzFuer(hoehe: number) {
    if (y + hoehe > maxY) seitenumbruch();
  }

  function abschnitt(titel: string) {
    platzFuer(18);
    setzeSchrift({ groesse: 12, fett: true });
    pdf.text(titel, RAND, y, { baseline: "top" });
    y += 7;
  }

  function felder(...paare: [label: string, wert: string | null][]) {
    const spaltenbreite = (breite - SPALTENABSTAND * (paare.length - 1)) / paare.length;
    const werte = paare.map(([label, wert], index) => ({
      label,
      x: RAND + index * (spaltenbreite + SPALTENABSTAND),
      format: wert === null ? null : textzeilen(wert.trim() || "–", { groesse: 10 }, spaltenbreite),
    }));
    const werthoehen = werte.map(({ format }) => format ? format.zeilen.length * format.zeilenhoehe : 7);
    const hoehe = Math.max(...werthoehen) + 8;
    platzFuer(hoehe);
    for (const { label, x, format } of werte) {
      pdf.setTextColor(72);
      setzeSchrift({ groesse: 8, fett: true });
      pdf.text(label, x, y, { baseline: "top" });
      pdf.setTextColor(0);
      if (format) {
        druckeText(format, x, y + 4);
      } else {
        // Die Vereinskasse kann die zugeteilte Referenz nach dem Druck eintragen.
        pdf.setDrawColor(150);
        pdf.line(x, y + 10, x + spaltenbreite, y + 10);
      }
    }
    y += hoehe;
  }

  function absatz(text: string) {
    const format = textzeilen(text, { groesse: 10 }, breite);
    for (const zeile of format.zeilen) {
      platzFuer(format.zeilenhoehe);
      druckeZeile(zeile, format, RAND, y);
      y += format.zeilenhoehe;
    }
    y += 5;
  }

  function unterschrift(signatur: Signatur | undefined) {
    if (!signatur) return;
    const textbreite = breite - BILD_BREITE - SPALTENABSTAND;
    const name = textzeilen(signatur.name, { groesse: 10, fett: true }, textbreite);
    const zeitUndOrt = textzeilen(
      `${signatur.ort}\n${lokalerZeitpunkt(signatur.zeitpunkt)}`,
      { groesse: 9 },
      textbreite,
    );
    const texthoehe = 7 + name.zeilen.length * name.zeilenhoehe;
    const hoehe = Math.max(texthoehe + zeitUndOrt.zeilen.length * zeitUndOrt.zeilenhoehe, BILD_HOEHE) + 6;
    platzFuer(hoehe);
    pdf.setDrawColor(190);
    pdf.line(RAND, y, seitenBreite - RAND, y);
    y += 3;
    setzeSchrift({ groesse: 9 });
    pdf.text(rollenLabel[signatur.rolle], RAND, y, { baseline: "top" });
    druckeText(name, RAND, y + 5);
    druckeText(zeitUndOrt, RAND, y + texthoehe);

    const bild = pdf.getImageProperties(signatur.bild);
    const massstab = Math.min(BILD_BREITE / bild.width, BILD_HOEHE / bild.height);
    pdf.addImage(
      signatur.bild,
      "PNG",
      seitenBreite - RAND - BILD_BREITE,
      y,
      bild.width * massstab,
      bild.height * massstab,
    );
    y += hoehe - 3;
  }

  kopf();
  abschnitt("Angaben zum Mitglied");
  felder(["Vor- und Nachname", signaturname(daten, "mitglied")], ["Geburtsdatum", geburtstag(daten.geburtsdatum)]);
  felder(["Straße und Hausnummer", daten.strasse], ["Postleitzahl und Ort", `${daten.plz} ${daten.ort}`]);
  felder(["Telefon", daten.telefon], ["E-Mail", daten.email]);
  felder(["Stammverein", daten.stammverein], ["Gesetzliche Vertretung", daten.vertretung]);
  abschnitt("Antrag und Beitrag");
  absatz(beitrittstext(vereinsname));
  abschnitt("Unterschriften zum Beitritt");
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
  abschnitt("Unterschrift für das SEPA-Mandat");
  unterschrift(nachweise.kontoinhaber);

  const seitenzahl = pdf.getNumberOfPages();
  for (let seite = 1; seite <= seitenzahl; seite += 1) {
    pdf.setPage(seite);
    setzeSchrift({ groesse: 8 });
    pdf.setTextColor(72);
    pdf.text(`Seite ${seite} von ${seitenzahl}`, seitenBreite - RAND, seitenHoehe - 11, { align: "right" });
  }

  pdf.save("TEST-Beitrittsantrag-und-SEPA-Mandat.pdf");
}
