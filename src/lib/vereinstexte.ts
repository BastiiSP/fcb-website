// ---------------------------------------------------------------------------
// Redaktionelle Texte der öffentlichen Marken-Seiten (/verein und /kontakt).
//
// Warum eine eigene Datei: Beide Seiten zeigen dieselbe Layout-Struktur, aber
// unterschiedliche Inhalte je Auftritt. Die Texte hier abzulegen hält die JSX
// frei von `tenant.id === "jfg" ? … : …`-Ketten und macht sichtbar, welche
// Bausteine noch echten Inhalt brauchen.
//
// KEINE markenabhängigen Struktur- oder Konfigurationswerte hier ablegen –
// Name, Logo, Domain, Instagram usw. bleiben in src/lib/tenant.ts.
//
// PLATZHALTER-Konvention: Ein Textblock mit gesetztem `platzhalterHinweis`
// wird auf der Seite zusätzlich mit einem Info-Banner gerendert. So ist im
// Browser (nicht nur im Code) erkennbar, dass der echte Text noch fehlt.
// ---------------------------------------------------------------------------

import { CalendarDays, Handshake, MapPin, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TenantId } from "@/lib/tenant";

export const STARTSEITEN_INTRO: Record<TenantId, { heading: string; text: string }> = {
  fcb: {
    heading: "Fußball in Burgkunstadt",
    text: "Der 1. FC 1911 Burgkunstadt e.V. – kurz FC Burgkunstadt oder FCB, die „Schuhstädter“ – ist der Fußballverein in Burgkunstadt. Seit 1911 spielen bei uns zwei Herrenmannschaften sowie die E-, F- und G-Junioren auf Haupt- und Nebenplatz am Alten Postweg. Die A- bis D-Junioren spielen in der eigenständigen JFG Kunstadt-Obermain.",
  },
  jfg: {
    heading: "Jugendfußball am Obermain",
    text: "Die JFG Kunstadt-Obermain – eingetragen als Junioren-Förder-Gemeinschaft Kunstadt-Obermain e.V. – ist die gemeinsame Nachwuchsförderung von drei Vereinen: dem 1. FC 1911 Burgkunstadt, der SG Roth-Main Mainroth und dem 1. FC 1916 Redwitz a. d. Rodach. Seit 2004 spielen bei uns die A-, B-, C- und D-Junioren leistungsorientiert zusammen.",
  },
};

/** Kachel im Abschnitt „Zahlen & Fakten". */
export interface VereinsFaktum {
  icon: LucideIcon;
  wert: string;
  text: string;
}

/** Fließtext-Abschnitt mit Überschrift. */
export interface VereinsTextblock {
  heading: string;
  absaetze: string[];
  /** Gesetzt = Inhalt ist noch nicht final, Seite zeigt ein Info-Banner. */
  platzhalterHinweis?: string;
}

/** Abschnitt „Vorstand & Ansprechpartner" – Name ist optional, weil er bei der JFG noch fehlt. */
export interface VereinsAnsprechpartner {
  heading: string;
  name?: string;
  funktion?: string;
  text: string;
  platzhalterHinweis?: string;
}

export interface VereinsSeitenTexte {
  /** H1 der Seite. */
  titel: string;
  untertitel: string;
  /** Wird in generateMetadata() mit dem Vereinsnamen aus der Marken-Config kombiniert. */
  metaTitel: string;
  metaBeschreibung: string;
  werWirSind: VereinsTextblock;
  geschichte: VereinsTextblock;
  faktenHeading: string;
  /** Gesetzt = mindestens eine Kachel enthält noch keinen echten Wert. */
  faktenPlatzhalterHinweis?: string;
  fakten: VereinsFaktum[];
  ansprechpartner: VereinsAnsprechpartner;
  cta: { heading: string; text: string };
}

// ---------------------------------------------------------------------------
// /verein
// ---------------------------------------------------------------------------

const VEREIN_FCB: VereinsSeitenTexte = {
  titel: "Der Verein",
  untertitel: "1. FC 1911 Burgkunstadt e. V., die Schuhstädter.",
  metaTitel: "Der Verein",
  metaBeschreibung:
    "Seit 1911 Fußball in der Schuhstadt: wer wir sind, woher wir kommen und wer beim 1. FC 1911 Burgkunstadt den Hut aufhat.",
  werWirSind: {
    heading: "Wer wir sind",
    absaetze: [
      "Wir sind der Fußballverein in Burgkunstadt. Rund 450 Mitglieder, zwei Plätze am Alten Postweg und an guten Sonntagen eine Bratwurst in der Hand. Das ist der FCB. Bei uns fangen die Kleinsten bei den Bambini an, und die Herren spielen sonntags um Punkte.",
      "Große Töne spucken wir nicht. Wir wollen, dass in Burgkunstadt jeder Fußball spielen kann, der Lust darauf hat. Egal ob mit sechs oder sechzig, ob im Tor oder am Grill. Wer einmal da war, kommt meistens wieder.",
    ],
  },
  geschichte: {
    heading: "Geschichte",
    absaetze: [
      "Gegründet 1911, als Burgkunstadt noch überall als Schuhstadt bekannt war. Daher tragen wir den Namen „Schuhstädter“ bis heute mit Stolz. Seitdem gehört der FCB fest zur Stadt: Generationen von Burgkunstadtern haben hier ihre ersten Tore geschossen.",
      "Über hundert Jahre Vereinsgeschichte heißt auch: Auf- und Abstiege, Platzbau in Eigenleistung und unzählige Ehrenamtliche, ohne die hier gar nichts laufen würde. Die ausführliche Chronik arbeiten wir nach und nach auf. Wer alte Fotos oder Geschichten hat, darf sich gerne melden.",
    ],
  },
  faktenHeading: "Zahlen & Fakten",
  fakten: [
    {
      icon: CalendarDays,
      wert: "1911",
      text: "gegründet, seit über 110 Jahren wird bei uns gekickt",
    },
    {
      icon: Users,
      wert: "≈ 450",
      text: "Mitglieder, vom Bambini bis zum Ehrenmitglied",
    },
    {
      icon: MapPin,
      wert: "2 Plätze",
      text: "Haupt- und Nebenplatz am Alten Postweg",
    },
    {
      icon: Handshake,
      wert: "JFG",
      text: "leistungsorientierte Jugendförderung mit den Nachbarvereinen",
    },
  ],
  ansprechpartner: {
    heading: "Vorstand & Ansprechpartner",
    name: "Wolfgang Strassgürtel",
    funktion: "1. Vorsitzender",
    text: "Den kompletten Vorstand stellen wir hier nach und nach vor. Bis dahin gilt: Bei Fragen einfach melden, wir leiten dich an die richtige Person weiter.",
  },
  cta: {
    heading: "Lust mitzumachen?",
    text: "Ob als Spieler, Trainer oder helfende Hand am Sportheim: Beim FCB gibt es immer was zu tun. Schau bei einer Mannschaft vorbei oder schreib uns.",
  },
};

// JFG-Texte: Trägervereine, Gründungsjahr und Jugendleitung sind echte
// Angaben (von Basti bestätigt bzw. recherchiert, siehe Verlauf in
// 02 Projekte/FCB Website.md). Exakte Amtsbezeichnungen der Jugendleitung
// waren nicht bekannt – bewusst allgemein gehalten ("Organisation"/"Sport")
// statt eine falsche offizielle Bezeichnung zu erfinden.
const VEREIN_JFG: VereinsSeitenTexte = {
  titel: "Die JFG",
  untertitel: "JFG Kunstadt-Obermain, Leistungsjugend der A- bis D-Junioren.",
  metaTitel: "Der Verein",
  metaBeschreibung:
    "Die JFG Kunstadt-Obermain (Junioren-Förder-Gemeinschaft Kunstadt-Obermain e.V.): Trägervereine, Struktur und leistungsorientierte Nachwuchsförderung der A- bis D-Junioren.",
  werWirSind: {
    heading: "Wer wir sind",
    absaetze: [
      "Die JFG Kunstadt-Obermain ist die gemeinsame Junioren-Förder-Gemeinschaft von drei Vereinen: dem 1. FC 1911 Burgkunstadt, der SG Roth-Main Mainroth und dem 1. FC 1916 Redwitz a. d. Rodach. Bei uns spielen die A-, B-, C- und D-Junioren zusammen – leistungsorientiert, damit jeder Jahrgang auf dem Niveau spielt, das zu ihm passt.",
      "Der Anspruch dahinter: eine Jugend aufbauen, die es mit den Leistungszentren der großen Vereine aufnehmen kann. Trotzdem bleibt bei uns Platz für jeden, der einfach kicken will – Leistungssport und Spaß am Ball schließen sich bei uns nicht aus.",
    ],
  },
  // Übergangslösung (2026-07-30): Der ausformulierte Text ist raus, weil der
  // zweite Absatz eine unbelegte Zahl enthielt ("rund 90 % der Spieler vom
  // FCB"). Bis der geplante Zeitstrahl mit belegter Chronik steht, ist hier
  // bewusst nur ein Platzhalter – lieber ehrlich leer als falsch belegt.
  geschichte: {
    heading: "Geschichte",
    absaetze: [
      "Hier entsteht gerade ein Zeitstrahl mit der ausführlichen JFG-Geschichte – schau bald wieder vorbei.",
    ],
  },
  faktenHeading: "Zahlen & Fakten",
  fakten: [
    {
      icon: CalendarDays,
      wert: "2004",
      text: "gegründet als gemeinsame Jugendförderung dreier Vereine",
    },
    {
      icon: Users,
      wert: "A–D",
      text: "Junioren, die Altersklassen der Leistungsjugend",
    },
    {
      icon: Handshake,
      wert: "3 Vereine",
      text: "FC Burgkunstadt, SG Roth-Main Mainroth & 1. FC Redwitz a. d. Rodach",
    },
    {
      icon: MapPin,
      wert: "Sportanlagen",
      text: "der drei Trägervereine in der Region",
    },
  ],
  ansprechpartner: {
    heading: "Struktur & Ansprechpartner",
    text: "Die Jugendleitung der JFG liegt bei André Petratschek (Organisation) und Marko Linß (Sport). Bei Fragen rund um die JFG meldest du dich am besten direkt bei den beiden oder über die Geschäftsstelle des 1. FC 1911 Burgkunstadt.",
  },
  cta: {
    heading: "Lust mitzumachen?",
    text: "Ob als Spieler, Trainer oder Betreuer: In der Leistungsjugend der JFG ist Platz für alle, die weiterkommen wollen. Schau bei einer Mannschaft vorbei oder schreib uns.",
  },
};

export const VEREINS_TEXTE: Record<TenantId, VereinsSeitenTexte> = {
  fcb: VEREIN_FCB,
  jfg: VEREIN_JFG,
};

// ---------------------------------------------------------------------------
// /kontakt
//
// Die physischen Kontaktdaten (Anschrift, Telefon, E-Mail, Ansprechpartner)
// sind bewusst NICHT markenabhängig: Die Sportanlage ist der gemeinsame
// Standort und eigene JFG-Kontaktdaten liegen nicht vor. Hier stehen nur die
// Texte, die den Verein namentlich ansprechen.
// ---------------------------------------------------------------------------

export interface KontaktSeitenTexte {
  untertitel: string;
  metaBeschreibung: string;
  /**
   * Dezenter Hinweis oberhalb der Kanäle. Nur gesetzt, wo die FCB-Kontaktdaten
   * ohne Erklärung irreführend wären (JFG-Auftritt).
   */
  hinweis?: string;
}

export const KONTAKT_TEXTE: Record<TenantId, KontaktSeitenTexte> = {
  fcb: {
    untertitel: "Meld dich einfach, irgendwer vom FCB hat immer das Handy dabei.",
    metaBeschreibung:
      "So erreichst du den 1. FC 1911 Burgkunstadt: Telefon, E-Mail, WhatsApp, Social Media und der Weg zum Sportgelände am Alten Postweg.",
  },
  jfg: {
    untertitel: "Meld dich einfach, irgendwer ist immer erreichbar.",
    metaBeschreibung:
      "So erreichst du die JFG Kunstadt-Obermain: Telefon, E-Mail, Social Media und der Weg zum Sportgelände am Alten Postweg.",
    // Kein hinweis mehr nötig: Telefon/E-Mail/Ansprechpartner sind seit
    // 2026-07-29 echte, eigene JFG-Daten (siehe rechtstexte.ts) – nur die
    // Trainingsanlage bleibt bewusst gemeinsam mit dem FCB (siehe Anfahrt
    // auf der Seite selbst, braucht keine Erklärung mehr).
  },
};
