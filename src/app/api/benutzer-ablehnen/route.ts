import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültiger JSON-Body" },
      { status: 400 }
    );
  }

  const userId =
    typeof body === "object" &&
    body !== null &&
    "userId" in body &&
    typeof body.userId === "string"
      ? body.userId
      : null;

  if (!userId || !UUID_REGEX.test(userId)) {
    return NextResponse.json({ error: "Ungültige userId" }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Serverkonfiguration fehlt" },
      { status: 500 }
    );
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  // Auth-Check: Ohne gültigen Access-Token darf niemand diese Route aufrufen.
  // (Sicherheitsfix 2026-08-12 – Route hatte vorher gar keinen Auth-Check und
  // konnte von jedem, der die URL kennt, zum Löschen beliebiger Accounts
  // missbraucht werden.)
  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const {
    data: { user: aufrufer },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError) {
    console.error("Fehler bei der Access-Token-Prüfung:", authError);
  }

  if (authError || !aufrufer) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  // Rollen-Check: Nur vorstand/admin dürfen Accounts ablehnen/löschen.
  const { data: aufruferProfil, error: profilError } = await supabaseAdmin
    .from("profiles")
    .select("rolle")
    .eq("id", aufrufer.id)
    .single();

  if (profilError) {
    console.error("Fehler beim Laden des Aufruferprofils:", profilError);
  }

  if (profilError || !aufruferProfil) {
    return NextResponse.json({ error: "Profil nicht gefunden" }, { status: 403 });
  }

  if (aufruferProfil.rolle !== "vorstand" && aufruferProfil.rolle !== "admin") {
    return NextResponse.json(
      { error: "Keine Berechtigung für diese Aktion" },
      { status: 403 }
    );
  }

  if (aufrufer.id === userId) {
    return NextResponse.json(
      { error: "Das eigene Konto kann nicht abgelehnt werden" },
      { status: 403 }
    );
  }

  // Sicherheitsfix 2026-09-24: Die Service-Role umgeht RLS vollständig.
  // Deshalb schützt allein diese serverseitige Zielprüfung bereits freigegebene
  // Konten und privilegierte Rollen vor einer versehentlichen Löschung.
  const { data: zielProfil, error: zielProfilError } = await supabaseAdmin
    .from("profiles")
    .select("rolle")
    .eq("id", userId)
    .maybeSingle();

  if (zielProfilError) {
    console.error("Fehler beim Laden des Zielprofils:", zielProfilError);
    return NextResponse.json(
      { error: "Zielprofil konnte nicht geprüft werden" },
      { status: 500 }
    );
  }

  if (!zielProfil) {
    return NextResponse.json({ error: "Profil nicht gefunden" }, { status: 404 });
  }

  if (zielProfil.rolle !== "ausstehend") {
    return NextResponse.json(
      { error: "Nur ausstehende Registrierungen können abgelehnt werden." },
      { status: 403 }
    );
  }

  const { error: loeschFehler } =
    await supabaseAdmin.auth.admin.deleteUser(userId);

  if (loeschFehler) {
    console.error("Fehler beim Löschen des Benutzerkontos:", loeschFehler);
    return NextResponse.json(
      { error: "Benutzerkonto konnte nicht gelöscht werden" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
