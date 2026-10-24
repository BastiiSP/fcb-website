import { test, expect } from "@playwright/test";
import { instagramBildAlt } from "../src/lib/instagramAlt";
import { istNoindexPfad, oeffentlichePfade, basisUrl } from "../src/lib/seo";
import { erstelleStartseitenJsonLd } from "../src/lib/strukturierteDaten";

test("interne Pfade werden exakt oder als Unterpfad erkannt", () => {
  for (const pfad of ["/login", "/passwort-vergessen", "/passwort-neu", "/auth/callback", "/vorstandsbereich", "/api/spielbetrieb"]) {
    expect(istNoindexPfad(pfad)).toBe(true);
  }
  for (const pfad of ["/", "/verein", "/vereinXYZ", "/vorstandsbereichXYZ", "/apiary"]) {
    expect(istNoindexPfad(pfad)).toBe(false);
  }
});

test("Sportheim steht nur in der FCB-Sitemap", () => {
  expect(oeffentlichePfade("fcb")).toContain("/sportheim");
  expect(oeffentlichePfade("jfg")).not.toContain("/sportheim");
});

test("strukturierte Daten trennen beide Domains bis auf die belegte Trägerbeziehung", () => {
  for (const id of ["fcb", "jfg"] as const) {
    const basis = basisUrl(id);
    const daten = erstelleStartseitenJsonLd(id);
    const [website, organisation] = daten["@graph"];
    expect(website.url).toBe(`${basis}/`);
    expect(organisation.url).toBe(`${basis}/`);
    expect(organisation.logo.startsWith(`${basis}/`)).toBe(true);
    expect(organisation).not.toHaveProperty("telephone");
    expect(JSON.stringify([website, { ...organisation, memberOf: undefined, member: undefined }]))
      .not.toContain(basisUrl(id === "fcb" ? "jfg" : "fcb"));
    if (id === "fcb") {
      expect(organisation.address.streetAddress).toBe("Alter Postweg 10");
      expect(organisation.memberOf?.url).toBe(`${basisUrl("jfg")}/`);
      expect(organisation.member).toBeUndefined();
    } else {
      expect(organisation.address).not.toHaveProperty("streetAddress");
      expect(organisation.member?.[0].url).toBe(`${basisUrl("fcb")}/`);
      expect(organisation.member?.slice(1).every((eintrag) => eintrag.url === undefined)).toBe(true);
      expect(organisation.memberOf).toBeUndefined();
    }
  }
});

test("Instagram-Alternativtext nutzt Berliner Datum und Bildposition", () => {
  const zeitstempel = "2026-10-12T00:00:00+02:00";
  expect(instagramBildAlt(zeitstempel)).toBe("Bild aus dem Instagram-Beitrag vom 12. Oktober 2026");
  expect(instagramBildAlt(zeitstempel, 2, 5)).toBe("Bild 2 von 5 aus dem Instagram-Beitrag vom 12. Oktober 2026");
  expect(instagramBildAlt("ungültig")).toBe("Bild aus einem Instagram-Beitrag");
});
