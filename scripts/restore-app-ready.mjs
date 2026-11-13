// Wartet ausschließlich auf die fest verdrahteten lokalen Dienste.
const targets = ["https://127.0.0.1:8000/auth/v1/health", "https://127.0.0.1:8000/rest/v1/", "https://127.0.0.1:8000/storage/v1/status", "https://127.0.0.1:3000/login"];
try {
  for (const url of targets) {
    let ready = false;
    for (let attempt = 0; attempt < 90; attempt++) {
      try {
        const response = await fetch(url, { headers: { apikey: process.env.RESTORE_ANON_KEY, authorization: `Bearer ${process.env.RESTORE_ANON_KEY}` }, redirect: "error", signal: AbortSignal.timeout(3000) });
        if (response.ok) { ready = true; break; }
      } catch { /* Ein noch startender lokaler Dienst wird erneut geprüft. */ }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!ready) throw new Error("Dienst nicht bereit.");
  }
} catch {
  process.stderr.write("Lokale Dienstbereitschaft nicht bestätigt.\n");
  process.exitCode = 1;
}
