import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pruefeRollen } from "./restore-app-roles.mjs";

function setup(leak = false, escalation = false, patchFailure = false) {
  const accounts = [["vorstand", "fcb"], ["vorstand", "jfg"], ["admin", "fcb"], ["mitglied", "jfg"], ["trainer", "fcb"], ["trainer", "jfg"]]
    .map(([rolle, tenant]) => ({ rolle, tenant, id: randomUUID(), token: randomUUID() }));
  let fixtures = [];
  let roleChanged = false;
  let booking;
  const request = async (url, options) => {
    const bearer = options.headers.authorization.slice(7);
    const who = accounts.find((a) => a.token === bearer);
    if (options.method === "POST" && url.endsWith("/buchungen")) {
      booking = JSON.parse(options.body);
      return new Response(null, { status: 201 });
    }
    if (options.method === "POST") {
      fixtures = JSON.parse(options.body);
      return new Response(null, { status: 201 });
    }
    if (options.method === "PATCH") {
      if (patchFailure) return new Response(null, { status: 500 });
      if (url.includes("/buchungen?")) {
        if (who.id === booking.user_id) Object.assign(booking, JSON.parse(options.body));
        return new Response(null, { status: 204 });
      }
      if (escalation && who.rolle === "mitglied") roleChanged = true;
      return new Response(null, { status: 204 });
    }
    let result;
    if (url.includes("/buchungen?")) {
      result = [{ id: booking.id, bemerkung: booking.bemerkung }];
    } else if (url.includes("/mitglieder?")) {
      result = fixtures.filter((row) => leak || who.rolle === "admin" || (who.rolle === "vorstand" && row.verein.includes(who.tenant))).map(({ id }) => ({ id }));
    } else {
      result = [{ id: who.id, rolle: roleChanged && who.rolle === "mitglied" ? "admin" : who.rolle }];
    }
    return new Response(JSON.stringify(result), { status: 200 });
  };
  return { accounts, request };
}

test("Tenant- und Rollenprüfung erkennt synthetische Lecks und Rollenerhöhung", async () => {
  const valid = setup();
  assert.deepEqual(await pruefeRollen(valid.accounts, "service", "anon", valid.request), { tenantCases: 4, roleCases: 2, bookingCases: 2 });
  const leaked = setup(true);
  await assert.rejects(pruefeRollen(leaked.accounts, "service", "anon", leaked.request));
  const escalated = setup(false, true);
  await assert.rejects(pruefeRollen(escalated.accounts, "service", "anon", escalated.request));
  const broken = setup(false, false, true);
  await assert.rejects(pruefeRollen(broken.accounts, "service", "anon", broken.request));
});
