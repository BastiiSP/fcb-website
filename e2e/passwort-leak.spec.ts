import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { GET, dynamic } from "../src/app/api/passwort-leak-check/route";
import { pruefePasswortLeak } from "../src/utils/passwortStaerke";

const PASSWORT = "P@ssw0rd123";
// Unabhängig von Web Crypto berechnet, damit der Test auch einen falschen Hash erkennt.
const HASH = createHash("sha1").update(PASSWORT).digest("hex").toUpperCase();
const SUFFIX = HASH.slice(5);
const ANDERER_SUFFIX = "0".repeat(35);
const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_CRYPTO = Object.getOwnPropertyDescriptor(globalThis, "crypto");

test.afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_CRYPTO) {
    Object.defineProperty(globalThis, "crypto", ORIGINAL_CRYPTO);
  }
});

test("Treffer erkennt kleingeschriebenes Suffix mit CRLF und liefert die Anzahl", async () => {
  const fetchImpl: typeof fetch = async () => new Response(
    `${ANDERER_SUFFIX}:17\r\n${SUFFIX.toLowerCase()}:1234\r\n`,
  );

  await expect(pruefePasswortLeak(PASSWORT, { fetchImpl })).resolves.toEqual({
    status: "geleakt", anzahl: 1234,
  });
});

test("ohne passenden Hash ist das Passwort sicher", async () => {
  const fetchImpl: typeof fetch = async () => new Response(`${ANDERER_SUFFIX}:42\n`);

  await expect(pruefePasswortLeak(PASSWORT, { fetchImpl })).resolves.toEqual({ status: "sicher" });
});

test("Padding mit passendem Suffix und Anzahl null gilt nicht als Leak", async () => {
  const fetchImpl: typeof fetch = async () => new Response(`${SUFFIX}:0\r\n`);

  await expect(pruefePasswortLeak(PASSWORT, { fetchImpl })).resolves.toEqual({ status: "sicher" });
});

test("nur fünf Hash-Zeichen werden ohne Passwort, vollständigen Hash oder Suffix übertragen", async () => {
  const aufrufe: { url: string; optionen: RequestInit | undefined }[] = [];
  const fetchImpl: typeof fetch = async (input, optionen) => {
    aufrufe.push({ url: String(input), optionen });
    return new Response(`${ANDERER_SUFFIX}:42`);
  };

  await pruefePasswortLeak(PASSWORT, { fetchImpl });

  expect(aufrufe).toHaveLength(1);
  const { url, optionen } = aufrufe[0];
  const prefix = new URL(url, "https://example.test").searchParams.get("prefix");
  expect(prefix).toMatch(/^[0-9A-F]{5}$/);
  expect(prefix).toBe(HASH.slice(0, 5));
  expect(url).toBe(`/api/passwort-leak-check?prefix=${HASH.slice(0, 5)}`);
  for (const geheimnis of [PASSWORT, HASH, SUFFIX]) {
    expect(url).not.toContain(geheimnis);
  }
  expect(optionen).toEqual({ cache: "no-store", signal: expect.any(AbortSignal) });
});

test("globalThis.fetch wird erst beim Aufruf aufgelöst und eigener Endpunkt unterstützt", async () => {
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return new Response(`${SUFFIX}:9`);
  };

  await expect(pruefePasswortLeak(PASSWORT, { endpunkt: "/test-pruefung" })).resolves.toEqual({
    status: "geleakt", anzahl: 9,
  });
  expect(urls).toEqual([`/test-pruefung?prefix=${HASH.slice(0, 5)}`]);
});

test("Netzwerkfehler liefert unbekannt statt zu werfen", async () => {
  const fetchImpl: typeof fetch = async () => { throw new Error("Netzwerk ausgefallen"); };

  await expect(pruefePasswortLeak(PASSWORT, { fetchImpl })).resolves.toEqual({
    status: "unbekannt", fehler: expect.any(String),
  });
});

test("HTTP 503 liefert unbekannt statt zu werfen", async () => {
  const fetchImpl: typeof fetch = async () => new Response(null, { status: 503 });

  await expect(pruefePasswortLeak(PASSWORT, { fetchImpl })).resolves.toEqual({
    status: "unbekannt", fehler: expect.any(String),
  });
});

test("Timeout bricht die wartende Anfrage ab und liefert unbekannt", async () => {
  let abgebrochen = false;
  // Ohne Abort bleibt diese Anfrage offen: Der Test prüft den echten Timeout-Pfad.
  const fetchImpl: typeof fetch = (_input, optionen) => new Promise<Response>((_resolve, reject) => {
    optionen?.signal?.addEventListener("abort", () => {
      abgebrochen = true;
      reject(optionen.signal?.reason);
    }, { once: true });
  });

  await expect(pruefePasswortLeak(PASSWORT, { fetchImpl, timeoutMs: 50 })).resolves.toEqual({
    status: "unbekannt", fehler: expect.any(String),
  });
  expect(abgebrochen).toBe(true);
});

test("fehlendes crypto.subtle liefert unbekannt ohne Netzwerkanfrage", async () => {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: {} });
  let aufrufe = 0;
  const fetchImpl: typeof fetch = async () => {
    aufrufe++;
    return new Response("");
  };

  await expect(pruefePasswortLeak(PASSWORT, { fetchImpl })).resolves.toEqual({
    status: "unbekannt", fehler: expect.any(String),
  });
  expect(aufrufe).toBe(0);
});

test("leeres Passwort bleibt ohne Krypto und Netzwerkanfrage sicher", async () => {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: undefined });
  let aufrufe = 0;
  const fetchImpl: typeof fetch = async () => {
    aufrufe++;
    return new Response("");
  };

  await expect(pruefePasswortLeak("", { fetchImpl })).resolves.toEqual({ status: "sicher" });
  expect(aufrufe).toBe(0);
});

for (const prefix of [null, "", "xyz", "ABCDEF", "GHIJK", "ABCDE\n"]) {
  test(`Route lehnt ungültiges Präfix ${JSON.stringify(prefix)} ab`, async () => {
    let aufrufe = 0;
    globalThis.fetch = async () => {
      aufrufe++;
      return new Response("");
    };
    const url = new URL("https://example.test/api/passwort-leak-check");
    if (prefix !== null) url.searchParams.set("prefix", prefix);

    const antwort = await GET(new Request(url));

    expect(antwort.status).toBe(400);
    expect(await antwort.json()).toEqual({ fehler: expect.any(String) });
    expect(aufrufe).toBe(0);
  });
}

test("Route normalisiert das Präfix, fordert Padding an und reicht Text ohne Cache durch", async () => {
  const aufrufe: { url: string; optionen: RequestInit | undefined }[] = [];
  const text = `${SUFFIX}:1234\r\n${ANDERER_SUFFIX}:0\r\n`;
  globalThis.fetch = async (input, optionen) => {
    aufrufe.push({ url: String(input), optionen });
    return new Response(text);
  };

  const antwort = await GET(new Request("https://example.test/api/passwort-leak-check?prefix=abCde"));

  expect(antwort.status).toBe(200);
  expect(await antwort.text()).toBe(text);
  expect(antwort.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
  expect(antwort.headers.get("Cache-Control")).toBe("no-store");
  expect(dynamic).toBe("force-dynamic");
  expect(aufrufe).toHaveLength(1);
  expect(aufrufe[0].url).toBe("https://api.pwnedpasswords.com/range/ABCDE");
  const optionen = aufrufe[0].optionen;
  const headers = new Headers(optionen?.headers);
  expect(headers.get("Add-Padding")).toBe("true");
  expect(headers.get("User-Agent")).toBe("vereins-webapp-leak-check");
  expect(optionen?.cache).toBe("no-store");
  expect(optionen?.signal).toBeInstanceOf(AbortSignal);
});

test("Route antwortet bei Netzwerkfehler mit 502", async () => {
  globalThis.fetch = async () => { throw new Error("Netzwerk ausgefallen"); };

  const antwort = await GET(new Request("https://example.test/api/passwort-leak-check?prefix=ABCDE"));

  expect(antwort.status).toBe(502);
  expect(await antwort.json()).toEqual({ fehler: expect.any(String) });
});

test("Route antwortet bei Upstream-Status 503 mit 502", async () => {
  globalThis.fetch = async () => new Response(null, { status: 503 });

  const antwort = await GET(new Request("https://example.test/api/passwort-leak-check?prefix=ABCDE"));

  expect(antwort.status).toBe(502);
  expect(await antwort.json()).toEqual({ fehler: expect.any(String) });
});

test("Route antwortet bei Upstream-Timeout mit 502", async () => {
  globalThis.fetch = async () => { throw new DOMException("Zeitüberschreitung", "TimeoutError"); };

  const antwort = await GET(new Request("https://example.test/api/passwort-leak-check?prefix=ABCDE"));

  expect(antwort.status).toBe(502);
  expect(await antwort.json()).toEqual({ fehler: expect.any(String) });
});
