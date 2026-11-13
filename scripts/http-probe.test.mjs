import assert from 'node:assert/strict';
import test from 'node:test';
import { probeAll, probeTarget } from './http-probe.mjs';

const target = { tenant: 'jfg', url: 'https://example.invalid/' };
const html = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

test('prüft beide Produktionsdomains mit dem jeweils richtigen Tenant', async () => {
  const requests = [];
  const results = await probeAll({ fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return html(`<html data-tenant="${url.includes('jfg') ? 'jfg' : 'fcb'}"></html>`);
  } });
  assert.equal(results.length, 2);
  assert.ok(results.every((result) => result.ok));
  assert.ok(requests.every(({ options }) => options.method === 'GET' && options.redirect === 'manual' && options.credentials === 'omit'));
});

test('erkennt falschen Tenant auch bei irreführendem Text im Dokument', async () => {
  const result = await probeTarget(target, { fetchImpl: async () => html('<html data-tenant="fcb"><body>data-tenant="jfg"</body></html>') });
  assert.equal(result.code, 'FALSCHER_TENANT');
  assert.equal(result.ok, false);
});

test('behandelt Fehlerstatus und Weiterleitungen als Ausfall', async () => {
  for (const status of [302, 404, 500, 503]) {
    const result = await probeTarget(target, { fetchImpl: async () => html('privater Antworttext', status) });
    assert.equal(result.code, 'HTTP_STATUS');
    assert.equal(result.status, status);
    assert.equal(result.ok, false);
    assert.ok(!JSON.stringify(result).includes('privater'));
  }
});

test('verwirft JSON und übergroße HTML-Antworten', async () => {
  const json = await probeTarget(target, { fetchImpl: async () => new Response('{}', { headers: { 'content-type': 'application/json' } }) });
  assert.equal(json.code, 'KEIN_HTML');
  const oversized = await probeTarget(target, { fetchImpl: async () => html('a'.repeat(2 * 1024 * 1024 + 1)) });
  assert.equal(oversized.code, 'ANTWORT_ZU_GROSS');
});

test('meldet Netzwerkfehler ohne vertrauliche Exception-Texte', async () => {
  const result = await probeTarget(target, { fetchImpl: async () => { throw new Error('secret-token=vertraulich'); } });
  assert.equal(result.code, 'NETZWERK');
  assert.ok(!JSON.stringify(result).includes('vertraulich'));
});

test('unterscheidet Zeitlimit vom sonstigen Netzwerkfehler', async () => {
  const result = await probeTarget(target, {
    timeoutMs: 1,
    fetchImpl: async (_url, { signal }) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      signal.throwIfAborted();
      return html('<html data-tenant="jfg"></html>');
    },
  });
  assert.equal(result.code, 'ZEITLIMIT');
});
