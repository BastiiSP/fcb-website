import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright-Konfiguration für den FCB-Website Smoke-Test.
 * Startet den Next.js-Dev-Server automatisch (oder nutzt einen laufenden).
 */
export default defineConfig({
  testDir: "./e2e",
  // Reine Unit-Tests laufen über playwright.unit.config.ts ohne Dev-Server
  testIgnore: ["bfv.spec.ts", "passwort-leak.spec.ts"],
  fullyParallel: true,
  forbidOnly: false,
  // Lokal keine Retries, damit echte Flakes sichtbar bleiben; auf CI einmal wiederholen
  retries: process.env.CI ? 1 : 0,
  // Fest 2 Worker: Mit der Default-Anzahl (CPU-Kerne/2) überlastet der
  // Next-Dev-Server beim On-Demand-Kompilieren und die Suite flakt
  workers: 2,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Dev-Server starten falls keiner läuft – reuseExistingServer verhindert Doppelstart
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
