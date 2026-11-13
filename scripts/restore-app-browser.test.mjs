import test from "node:test";
import assert from "node:assert/strict";
import { pruefeBrowservertrag } from "./restore-app-browser.mjs";

const certificate = `${"A".repeat(43)}=`;
const konten = [
  { email: "restore-fcb@example.invalid", password: "x".repeat(24), tenant: "fcb", rolle: "ausstehend" },
  { email: "restore-jfg@example.invalid", password: "y".repeat(24), tenant: "jfg", rolle: "mitglied" },
];
const avatar = { bucket: "avatars", name: "test/bild.png", bytes: 12, sha256: "a".repeat(64) };

test("Browservertrag verlangt beide Marken, beide Sperrhinweise und einen echten Avatarvertrag", () => {
  assert.doesNotThrow(() => pruefeBrowservertrag(konten, certificate, avatar));
  for (const [accounts, cert, object] of [
    [konten.slice(0, 1), certificate, avatar],
    [[konten[0], { ...konten[1], rolle: "ausstehend" }], certificate, avatar],
    [konten, "kein-zertifikat", avatar],
    [konten, certificate, { ...avatar, bucket: "andere" }],
    [konten, certificate, { ...avatar, name: "../bild.png" }],
    [konten, certificate, { ...avatar, bytes: 0 }],
    [konten, certificate, { ...avatar, sha256: "ungültig" }],
  ]) assert.throws(() => pruefeBrowservertrag(accounts, cert, object));
});
