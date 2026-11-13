import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { prepareRestoreApp, RESTORE_APP_IMAGES, pruefeAnwendung } from "./restore-app-orchestrator.mjs";

test("App-Vorbereitung lehnt veränderliche oder ausgetauschte Images vor einem Docker-Aufruf ab", async () => {
  for (const images of [
    { ...RESTORE_APP_IMAGES, auth: "supabase/gotrue:latest" },
    { ...RESTORE_APP_IMAGES, browser: `mcr.microsoft.com/playwright@sha256:${"a".repeat(64)}` },
    {},
  ]) await assert.rejects(prepareRestoreApp(images), /Phase: IMAGE_CHECK; Klasse: VERTRAG/);
});

test("App-Probe lehnt ein unbestätigtes Ziel vor Docker-Zugriff ab", async () => {
  await assert.rejects(pruefeAnwendung({ containerName: "production", destination: "/tmp", manifest: {}, storage: {} }, {}), /Restore-Ziel/);
});

test("Vorbereitungsfehler meldet nur feste Phase und Klasse", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "restore-app-command-"));
  const previous = process.env.PATH;
  try {
    await writeFile(path.join(directory, "docker"), "#!/bin/sh\nprintf 'network is unreachable private-value\\n' >&2\nexit 1\n", { mode: 0o755 });
    process.env.PATH = directory;
    await assert.rejects(prepareRestoreApp(), (error) => {
      assert.equal(error.message, "App-Vorbereitung fehlgeschlagen. Phase: IMAGE_PULL; Klasse: NETWORK.");
      return true;
    });
  } finally {
    process.env.PATH = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
