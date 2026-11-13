import { pathToFileURL } from 'node:url';

// Öffentliche Produktionsdomains werden ohne Konto, Cookies oder Schreibzugriff geprüft.
export const TARGETS = Object.freeze([
  { tenant: 'fcb', url: 'https://www.fcbuku.de/' },
  { tenant: 'jfg', url: 'https://www.jfg-kunstadt-obermain.de/' },
]);

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 20_000;

/** @param {Response} response */
async function readHtml(response) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let html = '';

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      html += decoder.decode(chunk.value, { stream: true });
    }
    return html + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

/**
 * Liefert nur feste Fehlercodes, Status und Dauer, niemals Antwortinhalt,
 * Exception-Texte, Query-Parameter oder Zugangsdaten.
 * @param {{ tenant: string, url: string }} target
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
 */
export async function probeTarget(target, { fetchImpl = fetch, timeoutMs = TIMEOUT_MS } = {}) {
  const started = performance.now();
  const result = { tenant: target.tenant, ok: false, code: 'NETZWERK', status: null, durationMs: 0 };
  const signal = AbortSignal.timeout(timeoutMs);

  try {
    const response = await fetchImpl(target.url, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      credentials: 'omit',
      headers: { accept: 'text/html', 'user-agent': 'FCB-JFG-Verfuegbarkeit/1.0' },
      signal,
    });
    result.status = response.status;

    if (response.status !== 200) {
      result.code = 'HTTP_STATUS';
      await response.body?.cancel();
      return result;
    }
    if (!/^text\/html(?:;|$)/i.test(response.headers.get('content-type') ?? '')) {
      result.code = 'KEIN_HTML';
      await response.body?.cancel();
      return result;
    }

    const html = await readHtml(response);
    if (html === null) {
      result.code = 'ANTWORT_ZU_GROSS';
      return result;
    }
    // Nur das echte Wurzelelement zählt, kein gleichlautender Text in RSC-Daten.
    const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? '';
    const tenant = htmlTag.match(/\bdata-tenant\s*=\s*(["'])([^"']+)\1/i)?.[2];
    if (tenant !== target.tenant) {
      result.code = 'FALSCHER_TENANT';
      return result;
    }
    result.ok = true;
    result.code = 'OK';
    return result;
  } catch {
    result.code = signal.aborted ? 'ZEITLIMIT' : 'NETZWERK';
    return result;
  } finally {
    result.durationMs = Math.round(performance.now() - started);
  }
}

/** @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [options] */
export async function probeAll(options) {
  return Promise.all(TARGETS.map((target) => probeTarget(target, options)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = await probeAll();
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }));
  process.exitCode = results.every((result) => result.ok) ? 0 : 1;
}
