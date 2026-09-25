import { defineConfig } from "@playwright/test";

/**
 * Playwright-Konfiguration für reine Unit-Tests (ohne Browser/Seite).
 * Bewusst OHNE webServer: Diese Specs importieren Module aus src/ direkt und
 * stubben fetch selbst – ein Dev-Server-Start kostet nur Zeit.
 * Aufruf: npm run test:unit
 */
export default defineConfig({
  testDir: "./e2e",
  // Liste muss mit testIgnore in playwright.config.ts übereinstimmen
  testMatch: ["bfv.spec.ts"],
  fullyParallel: true,
  retries: 0,
  reporter: "list",
});
