import { chromium } from "@playwright/test";

const APP = "https://127.0.0.1:3000";
const API = "https://127.0.0.1:8000";

// Nur die synthetischen Prüfkonten übergeben. Kein Playwright-Reporter, Trace,
// Screenshot oder Netzwerkmitschnitt mit Daten aus dem Restore erzeugen.
export function pruefeBrowservertrag(konten, zertifikatSpki, avatar) {
  if (typeof zertifikatSpki !== "string" || !/^[A-Za-z0-9+/]{43}=$/.test(zertifikatSpki) ||
    !Array.isArray(konten) || konten.length !== 2 || konten.some((konto) =>
    !/^[a-z0-9.+_-]+@[a-z0-9.-]+\.invalid$/i.test(konto.email) ||
    typeof konto.password !== "string" || konto.password.length < 16 ||
    !["fcb", "jfg"].includes(konto.tenant) ||
    !["ausstehend", "mitglied"].includes(konto.rolle)) ||
    !konten.some((konto) => konto.tenant === "fcb" && konto.rolle === "ausstehend") ||
    !konten.some((konto) => konto.tenant === "jfg" && konto.rolle === "mitglied") ||
    !avatar || avatar.bucket !== "avatars" || typeof avatar.name !== "string" ||
    avatar.name.split("/").some((part) => !part || part === "." || part === "..") ||
    !/^[a-f0-9]{64}$/.test(avatar.sha256) || !Number.isSafeInteger(avatar.bytes) || avatar.bytes < 1) {
    throw new Error("Ungültiger synthetischer Browservertrag.");
  }
}

export async function pruefeBrowser(konten, zertifikatSpki, avatar) {
  pruefeBrowservertrag(konten, zertifikatSpki, avatar);
  // Nur das für diesen Lauf erzeugte Zertifikat wird im isolierten Chromium akzeptiert.
  const browser = await chromium.launch({ headless: true, args: [`--ignore-certificate-errors-spki-list=${zertifikatSpki}`] });
  try {
    for (const konto of konten) {
      const context = await browser.newContext({ serviceWorkers: "block" });
      try {
        await context.route("**/*", async (route) => {
          const url = new URL(route.request().url());
          if (url.origin === APP || url.origin === API) await route.continue();
          else await route.abort();
        });
        const page = await context.newPage();
        await page.goto(`${APP}/login?tenant=${konto.tenant}`, { waitUntil: "domcontentloaded" });
        if (await page.locator("html").getAttribute("data-tenant") !== konto.tenant) throw new Error("Tenant stimmt nicht.");
        const cookieDialog = page.getByRole("dialog", { name: "Cookie-Einstellungen" });
        await cookieDialog.waitFor({ state: "visible", timeout: 30000 });
        await cookieDialog.getByRole("button", { name: "Nur Notwendiges" }).click({ timeout: 30000 });
        await cookieDialog.waitFor({ state: "hidden", timeout: 30000 });
        await page.getByLabel("E-Mail").fill(konto.email);
        await page.getByLabel("Passwort", { exact: true }).fill(konto.password);
        await Promise.all([
          page.waitForURL(`${APP}/`, { timeout: 30000 }),
          page.getByRole("button", { name: "Einloggen" }).click(),
        ]);
        await page.goto(`${APP}/platzbuchung?tenant=${konto.tenant}`, { waitUntil: "domcontentloaded" });
        const hinweis = konto.rolle === "ausstehend" ? "Dein Konto wartet noch auf Freigabe" : "nicht vorgesehen";
        await page.getByText(hinweis, { exact: false }).waitFor({ state: "visible", timeout: 30000 });
        // Der Browser lädt einen tatsächlich wiederhergestellten Avatar über
        // die öffentliche lokale Storage-API und prüft dessen unveränderte Bytes.
        const objectPath = avatar.name.split("/").map(encodeURIComponent).join("/");
        const result = await page.evaluate(async (url) => {
          const response = await fetch(url, { redirect: "error", cache: "no-store" });
          if (!response.ok) throw new Error("Avatar nicht abrufbar.");
          const bytes = await response.arrayBuffer();
          const digest = await crypto.subtle.digest("SHA-256", bytes);
          return { bytes: bytes.byteLength, sha256: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("") };
        }, `${API}/storage/v1/object/public/avatars/${objectPath}`);
        if (result.bytes !== avatar.bytes || result.sha256 !== avatar.sha256) throw new Error("Browser-Avatar weicht ab.");
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  return konten.length;
}
