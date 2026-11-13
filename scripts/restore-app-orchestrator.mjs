import { spawn, spawnSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonical, CATALOG_SQL } from "./backup-contract.mjs";
import { erzeugeLokaleSchluessel } from "./restore-app-jwt.mjs";
import { lokalisiereRestore } from "./restore-app-sql.mjs";
import { pruefeNamespaceContainer } from "./restore-app-isolation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repos = { auth: "supabase/gotrue", rest: "postgrest/postgrest", storage: "supabase/storage-api", browser: "mcr.microsoft.com/playwright" };
export const RESTORE_APP_IMAGES = Object.freeze({
  auth: "supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b",
  rest: "postgrest/postgrest@sha256:c7cd7e265a85b05248abf53f4473fcec7e327c282d0bd0cf60f1551996d09fcf",
  storage: "supabase/storage-api@sha256:8526956cb462e9f7d392e9848ec77133b2769982ed614e9753cc687e8e4339a6",
  browser: "mcr.microsoft.com/playwright@sha256:57b65fdc9ceabe0ef613124c7bbe2babcf9362c4d85e382fe3b03604e84b428a",
});
const quote = (s) => `"${s.replaceAll('"', '""')}"`;
const literal = (s) => `'${s.replaceAll("'", "''")}'`;

function command(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 900_000, ...options });
  if (result.status !== 0 || result.error) {
    const output = `${typeof result.stdout === "string" ? result.stdout : ""}\n${typeof result.stderr === "string" ? result.stderr : ""}`;
    const category = result.error?.code === "ETIMEDOUT" ? "ZEITLIMIT" :
      /module not found|cannot find module|cannot resolve|failed to resolve/i.test(output) ? "MODULE_MISSING" :
      /type error:|typescript error|error TS\d+:/i.test(output) ? "TYPESCRIPT" :
      /enotfound|econnreset|econnrefused|network is unreachable|temporary failure in name resolution|timed out/i.test(output) ? "NETWORK" : "UNBEKANNT";
    const error = new Error("Interner Vorbereitungsschritt fehlgeschlagen.");
    error.restoreClass = category;
    throw error;
  }
  return result.stdout?.trim() ?? "";
}

function proc(pid, property) {
  if (!Number.isSafeInteger(pid) || pid < 1 || !["net/dev", "net/route", "ns/net"].includes(property)) throw new Error("Ungültige Prozessprüfung.");
  return command("sudo", ["-n", property === "ns/net" ? "readlink" : "cat", `/proc/${pid}/${property}`], { stdio: ["ignore", "pipe", "pipe"] });
}

// Ausschließlich öffentliche Images und ein explizit zusammengestellter Kontext;
// keine Sicherungsdatei, .env-Datei oder Host-Zugangsdaten gelangen in den Build.
export async function prepareRestoreApp(images = RESTORE_APP_IMAGES) {
  if (!images || Object.keys(images).length !== Object.keys(repos).length) throw new Error("App-Vorbereitung fehlgeschlagen. Phase: IMAGE_CHECK; Klasse: VERTRAG.");
  for (const [name, repo] of Object.entries(repos)) {
    const prefix = `${repo}@sha256:`;
    if (typeof images?.[name] !== "string" || images[name] !== RESTORE_APP_IMAGES[name] || !images[name].startsWith(prefix) ||
        !/^[a-f0-9]{64}$/.test(images[name].slice(prefix.length))) throw new Error("App-Vorbereitung fehlgeschlagen. Phase: IMAGE_CHECK; Klasse: VERTRAG.");
  }
  const temp = await mkdtemp(path.join(os.tmpdir(), "fcb-app-build-"));
  const image = `fcb-app-probe:${randomBytes(12).toString("hex")}`;
  const keys = erzeugeLokaleSchluessel();
  let phase = "IMAGE_PULL";
  try {
    for (const ref of Object.values(images)) {
      phase = "IMAGE_PULL";
      command("docker", ["pull", "--platform", "linux/amd64", ref], { stdio: ["ignore", "pipe", "pipe"] });
      phase = "IMAGE_CHECK";
      const info = JSON.parse(command("docker", ["image", "inspect", ref]));
      if (info.length !== 1 || !info[0].RepoDigests?.includes(ref)) throw new Error("Imagekennung stimmt nicht.");
    }
    phase = "BUILD_CONTEXT";
    for (const name of ["package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "tailwind.config.ts", "postcss.config.js", "src", "public"]) {
      await cp(path.join(root, name), path.join(temp, name), {
        recursive: true,
        dereference: false,
        filter: (source) => !/^\.env(?:\.|$)/i.test(path.basename(source)),
      });
    }
    const dockerfile = await readFile(path.join(root, "scripts/restore-app-Dockerfile"), "utf8");
    const base = /^FROM\s+(\S+)\s*$/m.exec(dockerfile)?.[1];
    if (base !== images.browser) throw new Error("Gepinnte Buildgrundlage stimmt nicht.");
    await writeFile(path.join(temp, "Dockerfile"), dockerfile);
    phase = "BUILD";
    command("docker", ["build", "--pull=false", "--build-arg", "RESTORE_ANON_KEY", "--tag", image, temp], {
      env: { PATH: process.env.PATH, DOCKER_HOST: process.env.DOCKER_HOST, RESTORE_ANON_KEY: keys.anonKey }, stdio: ["ignore", "pipe", "pipe"],
    });
    phase = "IMAGE_ID";
    const imageId = command("docker", ["image", "inspect", "--format", "{{.Id}}", image]);
    if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error("Lokales App-Image fehlt.");
    return { image, imageId, images: { ...images }, keys };
  } catch (error) {
    spawnSync("docker", ["image", "rm", "-f", image], { stdio: "ignore" });
    const category = ["ZEITLIMIT", "MODULE_MISSING", "TYPESCRIPT", "NETWORK"].includes(error?.restoreClass) ? error.restoreClass : "UNBEKANNT";
    throw new Error(`App-Vorbereitung fehlgeschlagen. Phase: ${phase}; Klasse: ${category}.`);
  } finally { await rm(temp, { recursive: true, force: true }); }
}

export async function pruefeAnwendung({ containerName, destination, manifest, storage }, prepared) {
  if (!/^fcb-restore-[a-f0-9]{16}$/.test(containerName) || !prepared?.keys || !prepared?.imageId) throw new Error("Restore-Ziel fehlt.");
  const privateDir = await mkdtemp(path.join(os.tmpdir(), "fcb-app-private-"));
  const log = await open(path.join(privateDir, "private.log"), "wx", 0o600);
  const containers = [];
  let canary;
  const suffix = randomBytes(10).toString("hex");
  let phase = "ISOLATION";
  const docker = (args, input) => command("docker", args, { input, stdio: ["pipe", "pipe", log.fd] });
  const inspect = (name) => JSON.parse(docker(["inspect", name]))[0];
  try {
  const anchor = inspect(containerName);
  const anchorId = anchor.Id;
  const anchorPid = anchor.State.Pid;
  if (!/^[a-f0-9]{64}$/.test(anchorId) || anchor.HostConfig.NetworkMode !== "none" || !anchor.State.Running ||
      anchor.HostConfig.Privileged || anchor.HostConfig.CapAdd?.length || anchor.HostConfig.ExtraHosts?.length ||
      anchor.HostConfig.PidMode === "host" || anchor.HostConfig.IpcMode === "host" ||
      anchor.HostConfig.PortBindings && Object.keys(anchor.HostConfig.PortBindings).length ||
      anchor.Mounts.some((m) => m.Type !== "volume" && !(m.Type === "bind" && m.Source === destination && m.Destination === "/backup" && !m.RW))) throw new Error("Netzloser Restore-Anker fehlt.");
  const namespace = proc(anchorPid, "net/dev");
  const interfaces = namespace.split("\n").slice(2).map((line) => line.split(":")[0].trim()).filter(Boolean);
  const route = proc(anchorPid, "net/route");
  if (interfaces.length !== 1 || interfaces[0] !== "lo" || route.trim().split("\n").length !== 1) throw new Error("Restore-Netz ist nicht isoliert.");
  const hostIp = Object.values(os.networkInterfaces()).flat().find((item) => item?.family === "IPv4" && !item.internal)?.address;
  if (!hostIp) throw new Error("Host-Canary nicht verfügbar.");
  canary = spawn(process.execPath, ["-e", 'const h=require("node:http");h.createServer((_,r)=>r.end("canary")).listen(0,"0.0.0.0",function(){console.log(this.address().port)})'], { stdio: ["ignore", "pipe", "ignore"] });
  const hostPort = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Host-Canary startet nicht.")), 5000);
    canary.once("error", (error) => { clearTimeout(timer); reject(error); });
    canary.stdout.once("data", (chunk) => { clearTimeout(timer); resolve(String(chunk).trim()); });
  });
  if (!/^[0-9]{1,5}$/.test(hostPort)) throw new Error("Host-Canary ungültig.");
  const hostResponse = await fetch(`http://${hostIp}:${hostPort}`, { signal: AbortSignal.timeout(3000), redirect: "error" });
  if (!hostResponse.ok || await hostResponse.text() !== "canary") throw new Error("Host-Canary nicht erreichbar.");
  docker(["exec", containerName, "timeout", "3", "bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/5432"]);
  for (const target of ["1.1.1.1/80", "169.254.169.254/80", "172.17.0.1/80", "1.1.1.1/53", `${hostIp}/${hostPort}`, "2606:4700:4700::1111/53"]) {
    const check = spawnSync("docker", ["exec", containerName, "timeout", "3", "bash", "-c", `exec 3<>/dev/tcp/${target}`], { stdio: "ignore", timeout: 5000 });
    if (![1, 124].includes(check.status)) throw new Error("Netzausgang nicht ausgeschlossen.");
  }
  const dnsCheck = spawnSync("docker", ["exec", containerName, "timeout", "3", "bash", "-c", "printf x > /dev/udp/1.1.1.1/53"], { stdio: "ignore", timeout: 5000 });
  if (![1, 124].includes(dnsCheck.status)) throw new Error("DNS-Ausgang nicht ausgeschlossen.");
  const sql = (query) => docker(["exec", "-i", containerName, "sh", "-c", 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -XqAt -v ON_ERROR_STOP=1 -U supabase_admin -d isolated_restore'], `SET search_path = public, extensions;\n${query}`);
  async function start(label, image, explicitEnv, mounts, entrypoint, args = [], allowExit = false) {
    const name = `fcb-app-${label}-${suffix}`;
    const imageInfo = JSON.parse(docker(["image", "inspect", image]))[0];
    if (imageInfo.Config.Volumes && Object.keys(imageInfo.Config.Volumes).length) throw new Error("Nicht erlaubte Image-Volumes.");
    const inherited = Object.fromEntries((imageInfo.Config.Env ?? []).map((item) => { const i = item.indexOf("="); return [item.slice(0, i), item.slice(i + 1)]; }));
    const environment = { ...inherited, ...explicitEnv };
    for (const name of Object.keys(inherited)) {
      const emptySentry = name === "NEXT_PUBLIC_SENTRY_DSN" && inherited[name] === "";
      if (/^(?:HTTP|HTTPS|ALL|NO)_PROXY$/i.test(name) || /(?:SECRET|TOKEN|PASSWORD|CREDENTIAL|SENTRY_DSN)/i.test(name) && !emptySentry && !Object.hasOwn(explicitEnv, name)) throw new Error("Nicht erlaubte Image-Umgebung.");
    }
    const envFile = path.join(privateDir, `${label}.env`);
    await writeFile(envFile, Object.entries(explicitEnv).map(([k, v]) => `${k}=${v}\n`).join(""), { mode: 0o600 });
    const mountArgs = mounts.flatMap((m) => ["--mount", `type=bind,src=${m.Source},dst=${m.Destination},readonly`]);
    const opts = ["create", "--name", name, "--network", `container:${anchorId}`, "--env-file", envFile, ...mountArgs];
    if (entrypoint) opts.push("--entrypoint", entrypoint);
    opts.push(image, ...args);
    docker(opts);
    containers.push(name);
    pruefeNamespaceContainer(inspect(name), anchorId, environment, mounts);
    docker(["start", name]);
    const running = inspect(name);
    pruefeNamespaceContainer(running, anchorId, environment, mounts);
    if (!running.State.Running && !allowExit) throw new Error("Isolierter Dienst startet nicht.");
    if (running.State.Running && proc(running.State.Pid, "ns/net") !== proc(anchorPid, "ns/net")) throw new Error("Netznamespace weicht ab.");
    return name;
  }
  const mount = (source, target) => ({ Type: "bind", Source: source, Destination: target, RW: false });
    phase = "TLS";
    const tlsDir = path.join(privateDir, "tls");
    await mkdir(tlsDir, { mode: 0o700 });
    command("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1", "-keyout", path.join(tlsDir, "server.key"), "-out", path.join(tlsDir, "server.crt")], { stdio: ["ignore", "ignore", log.fd] });
    const spkiDer = command("openssl", ["x509", "-in", path.join(tlsDir, "server.crt"), "-pubkey", "-noout"]);
    const publicDer = spawnSync("openssl", ["pkey", "-pubin", "-outform", "DER"], { input: spkiDer, maxBuffer: 8192 });
    if (publicDer.status !== 0) throw new Error("TLS-Schlüsselprüfung fehlgeschlagen.");
    const spki = createHash("sha256").update(publicDer.stdout).digest("base64");
    const { jwtSecret, databasePassword: password, anonKey, serviceKey } = prepared.keys;
    if (!/^[a-f0-9]{64}$/.test(password)) throw new Error("Lokales Passwort ungültig.");
    phase = "ROLLEN";
    sql(`ALTER ROLE supabase_auth_admin WITH LOGIN PASSWORD '${password}'; ALTER ROLE authenticator WITH LOGIN PASSWORD '${password}'; ALTER ROLE supabase_storage_admin WITH LOGIN PASSWORD '${password}';`);
    const probeDir = path.join(privateDir, "probe");
    await mkdir(probeDir, { mode: 0o700 });
    for (const file of ["restore-app-gateway.mjs", "restore-app-ready.mjs", "restore-app-runner.mjs", "restore-app-accounts.mjs", "restore-app-roles.mjs", "restore-app-storage.mjs", "restore-app-browser.mjs"]) {
      await cp(path.join(root, "scripts", file), path.join(probeDir, file));
    }
    const commonMounts = [mount(probeDir, "/app/probe"), mount(tlsDir, "/tls")];
    const db = (role) => `postgres://${role}:${password}@127.0.0.1:5432/isolated_restore`;
    phase = "DIENSTE";
    await start("auth", prepared.images.auth, { GOTRUE_API_HOST: "127.0.0.1", GOTRUE_API_PORT: "9999", API_EXTERNAL_URL: "https://127.0.0.1:8000/auth/v1", GOTRUE_DB_DRIVER: "postgres", GOTRUE_DB_DATABASE_URL: db("supabase_auth_admin"), GOTRUE_SITE_URL: "https://127.0.0.1:3000", GOTRUE_URI_ALLOW_LIST: "", GOTRUE_DISABLE_SIGNUP: "true", GOTRUE_JWT_ADMIN_ROLES: "service_role", GOTRUE_JWT_AUD: "authenticated", GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated", GOTRUE_JWT_EXP: "3600", GOTRUE_JWT_SECRET: jwtSecret, GOTRUE_JWT_ISSUER: "https://127.0.0.1:8000/auth/v1", GOTRUE_EXTERNAL_EMAIL_ENABLED: "true", GOTRUE_MAILER_AUTOCONFIRM: "true", GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED: "false", GOTRUE_EXTERNAL_PHONE_ENABLED: "false", GOTRUE_HOOK_SEND_EMAIL_ENABLED: "false", GOTRUE_HOOK_SEND_SMS_ENABLED: "false" }, []);
    await start("rest", prepared.images.rest, { PGRST_DB_URI: db("authenticator"), PGRST_SERVER_HOST: "127.0.0.1", PGRST_SERVER_PORT: "3001", PGRST_DB_SCHEMAS: "public,storage,graphql_public", PGRST_DB_EXTRA_SEARCH_PATH: "public,extensions", PGRST_DB_ANON_ROLE: "anon", PGRST_JWT_SECRET: jwtSecret, PGRST_DB_USE_LEGACY_GUCS: "false" }, []);
    await start("storage", prepared.images.storage, { ANON_KEY: anonKey, SERVICE_KEY: serviceKey, POSTGREST_URL: "http://127.0.0.1:3001", AUTH_JWT_SECRET: jwtSecret, DATABASE_URL: db("supabase_storage_admin"), STORAGE_PUBLIC_URL: "https://127.0.0.1:8000", FILE_SIZE_LIMIT: "52428800", STORAGE_BACKEND: "file", GLOBAL_S3_BUCKET: "local-only", FILE_STORAGE_BACKEND_PATH: "/var/lib/storage", TENANT_ID: "local-only", REGION: "local-only", ENABLE_IMAGE_TRANSFORMATION: "false" }, []);
    await start("gateway", prepared.imageId, {}, commonMounts, "node", ["/app/probe/restore-app-gateway.mjs"]);
    await start("web", prepared.imageId, { VERCEL_ENV: "preview" }, [mount(tlsDir, "/tls")]);
    const ready = await start("ready", prepared.imageId, { RESTORE_ANON_KEY: anonKey }, commonMounts, "node", ["/app/probe/restore-app-ready.mjs"], true);
    if (docker(["wait", ready]) !== "0") throw new Error("Lokale Dienste nicht bereit.");
    phase = "VERTRAG";
    for (const table of manifest.tables) {
      const current = JSON.parse(sql(`SELECT json_build_object('rows',(SELECT count(*) FROM ${quote(table.schema)}.${quote(table.table)}),'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=${literal(table.schema)} AND c.relname=${literal(table.table)};`));
      if (current.rows !== table.rows || current.rls !== table.rls || current.forceRls !== table.forceRls) throw new Error("Tabellenvertrag geändert.");
    }
    const policies = JSON.parse(sql("SELECT coalesce(json_agg(p ORDER BY schemaname,tablename,policyname),'[]'::json) FROM pg_policies p WHERE schemaname NOT LIKE 'pg_%';"));
    if (canonical(policies) !== canonical(manifest.policies) || canonical(JSON.parse(sql(CATALOG_SQL))) !== canonical(manifest.catalog)) throw new Error("Dienste haben den Datenbankvertrag geändert.");
    phase = "LOKALISIERUNG";
    sql(`SET restore_app.isolation_verified = 'yes';\n${lokalisiereRestore}`);
    phase = "BROWSER";
    const runnerMounts = [...commonMounts, mount(path.join(destination, "storage.json"), "/payload/storage.json"), mount(path.join(destination, "objects"), "/payload/objects")];
    const runner = await start("runner", prepared.imageId, { RESTORE_ANON_KEY: anonKey, RESTORE_SERVICE_KEY: serviceKey, RESTORE_TLS_SPKI: spki }, runnerMounts, "node", ["/app/probe/restore-app-runner.mjs"], true);
    const result = docker(["wait", runner]);
    if (result !== "0") {
      const output = spawnSync("docker", ["logs", runner], { encoding: "utf8", timeout: 5000, maxBuffer: 1024 * 1024 });
      const marker = /^ANWENDUNGSPHASE:(STORAGE|AUTH|ROLLEN|BROWSER)$/m.exec(`${output.stdout ?? ""}\n${output.stderr ?? ""}`)?.[1];
      if (marker) phase = `ANWENDUNG_${marker}`;
      throw new Error("Anwendungsprüfung fehlgeschlagen.");
    }
    if (storage.objects.length < 1) throw new Error("Storage-Vertrag leer.");
    phase = "ISOLATION_NACHLAUF";
    for (const name of containers) {
      const current = inspect(name);
      if (current.HostConfig.NetworkMode !== `container:${anchorId}`) throw new Error("Netznamespace geändert.");
      if (current.State.Running && proc(current.State.Pid, "ns/net") !== proc(anchorPid, "ns/net")) throw new Error("Netznamespace geändert.");
    }
    const finalInterfaces = proc(anchorPid, "net/dev").split("\n").slice(2).map((line) => line.split(":")[0].trim()).filter(Boolean);
    const finalRoutes = proc(anchorPid, "net/route").trim().split("\n");
    if (finalInterfaces.length !== 1 || finalInterfaces[0] !== "lo" || finalRoutes.length !== 1) throw new Error("Netzisolierung geändert.");
    const finalCanary = spawnSync("docker", ["exec", containerName, "timeout", "3", "bash", "-c", `exec 3<>/dev/tcp/${hostIp}/${hostPort}`], { stdio: "ignore", timeout: 5000 });
    if (![1, 124].includes(finalCanary.status)) throw new Error("Hostabschirmung geändert.");
    return { applicationFlowsVerified: true, storageFiles: storage.objects.length, browserCases: 2 };
  } catch {
    throw new Error(`Isolierte Anwendungsprobe fehlgeschlagen. Phase: ${phase}.`);
  } finally {
    for (const name of containers.reverse()) spawnSync("docker", ["rm", "--force", "--volumes", name], { stdio: "ignore", timeout: 30_000 });
    canary?.kill();
    await log.close();
    await rm(privateDir, { recursive: true, force: true });
  }
}

export function entferneRestoreApp(prepared) {
  if (prepared?.image && /^fcb-app-probe:[a-f0-9]{24}$/.test(prepared.image)) spawnSync("docker", ["image", "rm", "-f", prepared.image], { stdio: "ignore", timeout: 30_000 });
}
