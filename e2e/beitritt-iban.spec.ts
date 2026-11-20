import { expect, test } from "@playwright/test";
import { gueltigeIban, ibanFehlermeldung, normalisiereIban, pruefeIban } from "../src/lib/beitritt";

const TEST_IBAN = "DE36000000000000000000";

test("IBAN übernimmt Kleinbuchstaben und Leerraum aus einer Vorlage", () => {
  expect(normalisiereIban("de36\u00a00000 0000\t0000\n0000 00")).toBe(TEST_IBAN);
  expect(pruefeIban(TEST_IBAN)).toEqual({ status: "gueltig", meldung: "IBAN formal gültig" });
  expect(ibanFehlermeldung(TEST_IBAN)).toBeUndefined();
});

test("deutsche IBAN unterscheidet fehlende Ziffern, Format und Prüfzifferfehler", () => {
  const unvollstaendig = TEST_IBAN.slice(0, -3);
  expect(pruefeIban(unvollstaendig)).toEqual({ status: "unvollstaendig", meldung: "Noch 3 Ziffern" });
  expect(ibanFehlermeldung(unvollstaendig)).toBe("Noch 3 Ziffern");

  const falschesZeichen = TEST_IBAN.slice(0, -1) + "-";
  expect(normalisiereIban(falschesZeichen)).toBe(falschesZeichen);
  expect(ibanFehlermeldung(falschesZeichen)).toBe("Nach DE sind nur Ziffern erlaubt.");
  expect(ibanFehlermeldung(TEST_IBAN + "0")).toBe("Nach DE müssen genau 20 Ziffern stehen.");
  expect(ibanFehlermeldung(TEST_IBAN.slice(0, -1) + "1"))
    .toBe("Bitte vergleiche die IBAN noch einmal mit deiner Vorlage.");
});

test("internationale IBAN erlaubt weiterhin Buchstaben im Kontoteil", () => {
  expect(gueltigeIban("gb82 west 1234 5698 7654 32")).toBe(true);
  expect(pruefeIban("gb82 west 1234 5698 7654 32").meldung).toBe("IBAN-Prüfsumme stimmt");
  expect(gueltigeIban("gb82 west 1234 5698 7654 33")).toBe(false);
  expect(pruefeIban("gb82 west 1234 5698 7654 33").pruefsummenfehler).toBe(true);
  expect(pruefeIban("GB82WEST1234").status).toBe("unvollstaendig");
  expect(ibanFehlermeldung("GBAB WEST 1234 5698 7654 32"))
    .toBe("Auf den Ländercode müssen zwei Ziffern folgen.");
});
