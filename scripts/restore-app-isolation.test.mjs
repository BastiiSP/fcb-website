import test from "node:test";
import assert from "node:assert/strict";
import { pruefeContainer, pruefeInternesNetz, pruefeNamespaceContainer } from "./restore-app-isolation.mjs";

const network = { Name: "restore-intern", Id: "isolated-id", Driver: "bridge", Internal: true, Ingress: false };
const env = { NODE_ENV: "production", NEXT_PUBLIC_SENTRY_DSN: "" };
function container() {
  return {
    HostConfig: { NetworkMode: network.Name, Privileged: false, PortBindings: null, ExtraHosts: null, CapAdd: null },
    NetworkSettings: { Networks: { [network.Name]: { NetworkID: network.Id } } },
    Mounts: [],
    Config: { Env: ["NODE_ENV=production", "NEXT_PUBLIC_SENTRY_DSN="] },
  };
}

test("nur das erwartete interne Netz und ein einfach isolierter Container bestehen", () => {
  assert.doesNotThrow(() => pruefeInternesNetz(network, "restore-intern"));
  assert.doesNotThrow(() => pruefeContainer(container(), network, "restore-intern", env));
  assert.throws(() => pruefeInternesNetz({ ...network, Internal: false }, "restore-intern"));
  assert.throws(() => pruefeInternesNetz(network, "anderes-netz"));
});

test("gemeinsamer Namespace verlangt exakten Anker sowie vollständige Mount- und Umgebungsliste", () => {
  const id = "a".repeat(64);
  const value = container();
  value.HostConfig.NetworkMode = `container:${id}`;
  assert.doesNotThrow(() => pruefeNamespaceContainer(value, id, env));
  value.HostConfig.NetworkMode = "host";
  assert.throws(() => pruefeNamespaceContainer(value, id, env));
  value.HostConfig.NetworkMode = `container:${id}`;
  value.Config.Env.push("PRODUKTIV=secret");
  assert.throws(() => pruefeNamespaceContainer(value, id, env));
});

test("zweites Netz, Port, privilegierter Modus, Hostalias und Capability scheitern", () => {
  for (const mutate of [
    (c) => { c.NetworkSettings.Networks.bridge = { NetworkID: "outside" }; },
    (c) => { c.HostConfig.PortBindings = { "3000/tcp": [{ HostIp: "127.0.0.1", HostPort: "3000" }] }; },
    (c) => { c.HostConfig.Privileged = true; },
    (c) => { c.HostConfig.ExtraHosts = ["host.docker.internal:host-gateway"]; },
    (c) => { c.HostConfig.CapAdd = ["NET_ADMIN"]; },
  ]) {
    const value = container();
    mutate(value);
    assert.throws(() => pruefeContainer(value, network, "restore-intern", env));
  }
});

test("Mounts und produktive oder umleitende Umgebung werden nur explizit erlaubt", () => {
  const value = container();
  const mount = { Type: "bind", Source: "/private/input", Destination: "/payload", RW: false };
  value.Mounts.push(mount);
  assert.throws(() => pruefeContainer(value, network, "restore-intern", env));
  assert.doesNotThrow(() => pruefeContainer(value, network, "restore-intern", env, [mount]));
  for (const entry of ["BACKUP_DB_PASSWORD=x", "AWS_SECRET_ACCESS_KEY=x", "RESTIC_PASSWORD=x", "https_proxy=http://proxy", "NEXT_PUBLIC_SENTRY_DSN=x", "NEXT_PUBLIC_SUPABASE_URL=https://production.example"]) {
    const withSecret = container();
    withSecret.Config.Env.push(entry);
    assert.throws(() => pruefeContainer(withSecret, network, "restore-intern", env));
  }
});
