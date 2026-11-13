import { createHmac, randomBytes } from "node:crypto";

// Frische Testschlüssel nur im privaten Arbeitsspeicher erzeugen.
export function erzeugeLokaleSchluessel() {
  const jwtSecret = randomBytes(32).toString("hex");
  const databasePassword = randomBytes(32).toString("hex");
  const now = Math.floor(Date.now() / 1000);
  const sign = (role) => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ role, iss: "https://127.0.0.1:8000/auth/v1", iat: now, exp: now + 3600 })).toString("base64url");
    const message = `${header}.${payload}`;
    return `${message}.${createHmac("sha256", jwtSecret).update(message).digest("base64url")}`;
  };
  return { jwtSecret, databasePassword, anonKey: sign("anon"), serviceKey: sign("service_role") };
}
