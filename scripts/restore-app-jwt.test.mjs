import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { erzeugeLokaleSchluessel } from "./restore-app-jwt.mjs";

test("lokale Schlüssel sind frisch und signieren nur die vorgesehenen Rollen", () => {
  const keys = erzeugeLokaleSchluessel();
  assert.notEqual(keys.jwtSecret, erzeugeLokaleSchluessel().jwtSecret);
  assert.match(keys.jwtSecret, /^[a-f0-9]{64}$/);
  assert.match(keys.databasePassword, /^[a-f0-9]{64}$/);
  for (const [token, role] of [[keys.anonKey, "anon"], [keys.serviceKey, "service_role"]]) {
    const [header, payload, signature] = token.split(".");
    assert.equal(signature, createHmac("sha256", keys.jwtSecret).update(`${header}.${payload}`).digest("base64url"));
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    assert.equal(claims.role, role);
    assert.equal(claims.exp - claims.iat, 3600);
    assert.equal(claims.iss, "https://127.0.0.1:8000/auth/v1");
  }
});
