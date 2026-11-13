import { expect, test } from "@playwright/test";
import { bereinigeSentryEvent } from "../src/lib/sentry-privacy";

test("Sentry-Ereignisse enthalten keine freien Inhalte oder personenbezogenen Daten", () => {
  const marker = "PRIVATE_MARKER_123";
  const event = {
    event_id: "0123456789abcdef0123456789abcdef",
    timestamp: 123,
    message: marker,
    user: { id: marker, email: marker, ip_address: marker },
    request: { url: `https://example.test/${marker}?token=${marker}`, headers: { cookie: marker }, data: marker },
    breadcrumbs: [{ message: marker }],
    extra: { marker },
    contexts: { marker },
    tags: { marker },
    exception: { values: [{
      type: marker,
      value: marker,
      stacktrace: { frames: [{ filename: marker, function: marker, vars: { marker }, lineno: 42, colno: 3, in_app: true }] },
    }] },
  };
  const result = bereinigeSentryEvent(event);
  expect(JSON.stringify(result)).not.toContain(marker);
  expect(result.exception.values[0]).toMatchObject({ type: "Error", stacktrace: { frames: [{ lineno: 42, colno: 3, in_app: true }] } });
  expect(result.event_id).toBe(event.event_id);
});

test("ungültige IDs und Freitext werden auch ohne Exception entfernt", () => {
  const result = bereinigeSentryEvent({ event_id: "private-id" });
  expect(result.event_id).toBeUndefined();
  expect(result.exception.values[0].type).toBe("Error");
});


test("nur feste Testcodes und gehashte Build-Dateien bleiben erhalten", () => {
  const result = bereinigeSentryEvent({ exception: { values: [{
    type: "TypeError", value: "FCB_SENTRY_TEST_CLIENT",
    stacktrace: { frames: [{ filename: "https://example.test/_next/static/chunks/abcdef123456.js?secret=PRIVATE_MARKER", lineno: 12 }] },
  }] } });
  expect(result.exception.values[0].value).toBe("FCB_SENTRY_TEST_CLIENT");
  expect(result.exception.values[0].stacktrace?.frames[0].filename).toBe("/_next/static/chunks/abcdef123456.js");
  expect(JSON.stringify(result)).not.toContain("PRIVATE_MARKER");
});


test("Serverposition und feste Metadaten bleiben ohne absolute Pfade erhalten", () => {
  const sha = "a".repeat(40);
  const result = bereinigeSentryEvent({ exception: { values: [{
    type: "TypeError", stacktrace: { frames: [{ filename: "/private/PRIVATE_MARKER/.next/server/chunks/ssr/abcdef123456.js?secret=PRIVATE_MARKER", lineno: 17, colno: 9 }] },
  }] } }, { laufzeit: "server", umgebung: "preview", release: sha });
  expect(result.tags).toEqual({ laufzeit: "server" });
  expect(result.environment).toBe("preview");
  expect(result.release).toBe(sha);
  expect(result.exception.values[0].stacktrace?.frames[0]).toMatchObject({ filename: "/.next/server/chunks/abcdef123456.js", lineno: 17, colno: 9 });
  expect(JSON.stringify(result)).not.toContain("PRIVATE_MARKER");
});

test("unbekannte Umgebung und ungültige Release-ID werden verworfen", () => {
  const result = bereinigeSentryEvent({}, { laufzeit: "edge", umgebung: "PRIVATE_MARKER", release: "PRIVATE_MARKER" });
  expect(result.tags).toEqual({ laufzeit: "edge" });
  expect(result.environment).toBeUndefined();
  expect(result.release).toBeUndefined();
});
