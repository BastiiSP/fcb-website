import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { lokalesZiel, starteGateway, starteWebGateway } from "./restore-app-gateway.mjs";

test("Gateway wählt ausschließlich feste Loopback-Ziele", () => {
  assert.deepEqual(lokalesZiel("/auth/v1/token?grant_type=password"), { host: "127.0.0.1", port: 9999, path: "/token?grant_type=password" });
  assert.deepEqual(lokalesZiel("/rest/v1/profiles?id=eq.test"), { host: "127.0.0.1", port: 3001, path: "/profiles?id=eq.test" });
  assert.deepEqual(lokalesZiel("/storage/v1/object/bucket/test"), { host: "127.0.0.1", port: 5000, path: "/object/bucket/test" });
  for (const value of ["/other", "http://example.invalid/auth/v1/users", "//example.invalid/auth/v1/users", "/auth/v1/../other"]) assert.equal(lokalesZiel(value), null);
});

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => { server.off("error", reject); resolve(server); });
  });
}
function request(port, ca, requestPath, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request({ host: "127.0.0.1", port, ca, path: requestPath, ...options }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (part) => { body += part; });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end(options.body);
  });
}

test("HTTPS-Gateways leiten echte lokale Anfragen weiter und begrenzen CORS", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "restore-gateway-test-"));
  const servers = [];
  try {
    const keyPath = path.join(dir, "key.pem"), certPath = path.join(dir, "cert.pem");
    const generated = spawnSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1", "-keyout", keyPath, "-out", certPath], { stdio: "ignore" });
    assert.equal(generated.status, 0, "Testzertifikat konnte nicht erzeugt werden.");
    const key = await readFile(keyPath), cert = await readFile(certPath);
    for (const port of [9999, 3001, 5000, 3002]) {
      const service = http.createServer((req, res) => {
        let body = "";
        req.on("data", (part) => { body += part; });
        req.on("end", () => {
          res.setHeader("access-control-allow-origin", "https://falsch.invalid");
          res.setHeader("access-control-allow-credentials", "true");
          res.end(JSON.stringify({ port, path: req.url, method: req.method, body, host: req.headers.host }));
        });
      });
      servers.push(await listen(service, port));
    }
    const api = await listen(starteGateway({ key, cert }), 0); servers.push(api);
    const web = await listen(starteWebGateway({ key, cert }), 0); servers.push(web);
    const apiPort = api.address().port, webPort = web.address().port;
    for (const [requestPath, servicePort, expectedPath] of [["/auth/v1/token?x=1", 9999, "/token?x=1"], ["/rest/v1/profiles", 3001, "/profiles"], ["/storage/v1/object/test", 5000, "/object/test"]]) {
      const response = await request(apiPort, cert, requestPath, { method: "POST", headers: { origin: "https://127.0.0.1:3000" }, body: "test" });
      assert.equal(response.status, 200);
      assert.equal(response.headers["access-control-allow-origin"], "https://127.0.0.1:3000");
      assert.equal(response.headers["access-control-allow-credentials"], undefined);
      assert.deepEqual(JSON.parse(response.body), { port: servicePort, path: expectedPath, method: "POST", body: "test", host: `127.0.0.1:${servicePort}` });
    }
    assert.equal((await request(apiPort, cert, "/auth/v1/token", { headers: { origin: "https://falsch.invalid" } })).status, 403);
    assert.equal((await request(apiPort, cert, "/other", { method: "OPTIONS", headers: { origin: "https://127.0.0.1:3000" } })).status, 404);
    const preflight = await request(apiPort, cert, "/rest/v1/profiles", { method: "OPTIONS", headers: { origin: "https://127.0.0.1:3000" } });
    assert.equal(preflight.status, 204);
    assert.match(preflight.headers["access-control-allow-headers"], /\bx-supabase-api-version\b/);
    const page = await request(webPort, cert, "/login?from=test", { headers: { host: "127.0.0.1:3000" } });
    assert.deepEqual(JSON.parse(page.body), { port: 3002, path: "/login?from=test", method: "GET", body: "", host: "127.0.0.1:3000" });
  } catch (error) {
    if (error.code === "EPERM" && !process.env.CI) t.skip("Lokale Sandbox erlaubt keine TCP-Listener; CI muss diesen Test ausführen.");
    else throw error;
  } finally {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
    await rm(dir, { recursive: true, force: true });
  }
});
