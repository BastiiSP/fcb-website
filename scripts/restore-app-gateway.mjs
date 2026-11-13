import http from "node:http";
import https from "node:https";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const gatewayOrigin = "https://127.0.0.1:8000";
const webOrigin = "https://127.0.0.1:3000";
const services = [
  { prefix: "/auth/v1/", host: "127.0.0.1", port: 9999 },
  { prefix: "/rest/v1/", host: "127.0.0.1", port: 3001 },
  { prefix: "/storage/v1/", host: "127.0.0.1", port: 5000 },
];

export function lokalesZiel(requestUrl) {
  let target;
  try { target = new URL(requestUrl, gatewayOrigin); }
  catch { return null; }
  if (target.origin !== gatewayOrigin) return null;
  const service = services.find(({ prefix }) => target.pathname.startsWith(prefix));
  if (!service) return null;
  return { host: service.host, port: service.port, path: `/${target.pathname.slice(service.prefix.length)}${target.search}` };
}

function weiterleiten(req, res, target, removeCors = false) {
  const headers = { ...req.headers };
  if (removeCors) headers.host = `${target.host}:${target.port}`;
  const proxy = http.request({ ...target, method: req.method, headers }, (upstream) => {
    const headers = { ...upstream.headers };
    if (removeCors) for (const name of Object.keys(headers)) if (name.startsWith("access-control-")) delete headers[name];
    if (removeCors && req.headers.origin) headers.vary = headers.vary ? `${headers.vary}, Origin` : "Origin";
    res.writeHead(upstream.statusCode ?? 502, headers);
    upstream.pipe(res);
  });
  proxy.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
  req.on("error", () => proxy.destroy());
  req.pipe(proxy);
}

export function starteGateway(tls) {
  return https.createServer(tls, (req, res) => {
    const origin = req.headers.origin;
    if (origin && origin !== webOrigin) { res.writeHead(403).end(); return; }
    const target = lokalesZiel(req.url ?? "");
    if (!target) { res.writeHead(404).end(); return; }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", webOrigin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info, x-supabase-api-version, prefer, range, x-upsert, accept-profile, content-profile");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
      res.setHeader("Access-Control-Expose-Headers", "content-range, content-length, location");
    }
    if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }
    weiterleiten(req, res, target, true);
  });
}

export function starteWebGateway(tls) {
  return https.createServer(tls, (req, res) => {
    // Das Ziel ist fest und kann nicht über URL oder Header beeinflusst werden.
    weiterleiten(req, res, { host: "127.0.0.1", port: 3002, path: req.url ?? "/" });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tls = { key: readFileSync("/tls/server.key"), cert: readFileSync("/tls/server.crt") };
  starteGateway(tls).listen(8000, "127.0.0.1");
  starteWebGateway(tls).listen(3000, "127.0.0.1");
}
