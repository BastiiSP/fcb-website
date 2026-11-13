import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { synthetischeKontenErstellen } from "./restore-app-accounts.mjs";

test("sieben synthetische Konten nur am internen Ziel anlegen und einzeln anmelden", async () => {
  const users = new Map();
  const profiles = new Map();
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options });
    let result;
    if (url.endsWith("/auth/v1/admin/users")) {
      const { email, password } = JSON.parse(options.body);
      const id = randomUUID();
      users.set(email, { id, password });
      result = { id };
    } else if (url.includes("/auth/v1/token?")) {
      const { email, password } = JSON.parse(options.body);
      const user = users.get(email);
      assert.equal(password, user.password);
      result = { user: { id: user.id }, access_token: `token-${user.id}` };
    } else {
      const id = new URL(url).searchParams.get("id").slice(3);
      if (options.method === "PATCH") profiles.set(id, { id, ...JSON.parse(options.body) });
      result = [profiles.get(id)];
    }
    return new Response(JSON.stringify(result), { status: 200, headers: { "content-type": "application/json" } });
  };
  const accounts = await synthetischeKontenErstellen("lokaler-service", "lokaler-anon", request);
  assert.equal(accounts.length, 7);
  assert.deepEqual(accounts.map(({ rolle }) => rolle), ["ausstehend", "mitglied", "trainer", "trainer", "vorstand", "vorstand", "admin"]);
  assert.equal(new Set(accounts.map(({ email }) => email)).size, 7);
  assert.ok(accounts.every(({ email }) => email.endsWith("@example.invalid")));
  assert.ok(calls.every(({ url, options }) => url.startsWith("https://127.0.0.1:8000/") && options.redirect === "error"));
  await assert.rejects(synthetischeKontenErstellen("", "lokaler-anon", request));
  await assert.rejects(synthetischeKontenErstellen("lokaler-service", "lokaler-anon", async () => new Response(null, { status: 403 })));
});
