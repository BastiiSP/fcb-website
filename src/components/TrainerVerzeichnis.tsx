"use client";

import { useEffect, useState } from "react";
import { MapPin, Phone, Users } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";

// Nur die für das Verzeichnis relevanten Felder aus der geschützten RPC
type TrainerProfil = {
  id: string;
  vorname: string;
  nachname: string;
  telefonnummer: string | null;
  rolle: string;
  mannschaft: string[] | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
};

// Lesbare Bezeichnung für die angezeigte Rolle
const ROLLEN_LABEL: Record<string, string> = {
  trainer: "Trainer",
  vorstand: "Vorstand",
  admin: "Admin",
};

export default function TrainerVerzeichnis() {
  const supabase = createClient();
  const [profile, setProfile] = useState<TrainerProfil[]>([]);
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState("");

  useEffect(() => {
    ladeProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ladeProfile = async () => {
    setLaden(true);
    // Die RPC ist die einzige freigegebene Datenquelle für das Verzeichnis,
    // damit kein direkter SELECT auf sensible Profildaten nötig ist.
    const { data, error } = await supabase.rpc("trainer_verzeichnis");

    if (error) {
      setFehler("Fehler beim Laden des Verzeichnisses: " + error.message);
    } else {
      const eintraege = (data ?? []) as TrainerProfil[];
      setProfile(
        [...eintraege].sort((a, b) =>
          a.nachname.localeCompare(b.nachname, "de")
        )
      );
    }
    setLaden(false);
  };

  if (laden) {
    return (
      <p className="text-center opacity-70 mt-8">Lade Verzeichnis …</p>
    );
  }

  if (fehler) {
    // Fehleranzeige: tinted Banner-Stil – funktioniert in beiden Themes
    return (
      <p className="text-fcb-red text-sm p-3 border border-fcb-red/40 rounded bg-fcb-red/10">
        {fehler}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-60">
        {profile.length} {profile.length === 1 ? "Person" : "Personen"} im Verzeichnis
      </p>

      {profile.length === 0 && (
        <p className="text-center italic opacity-60 mt-8">
          Keine Einträge gefunden.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {profile.map((p) => {
          const adresszeile = [p.plz, p.ort].filter(Boolean).join(" ");
          const hatAdresse = Boolean(p.strasse || adresszeile);
          const hatKontaktinfos = Boolean(
            p.telefonnummer || (p.mannschaft && p.mannschaft.length > 0) || hatAdresse
          );

          return (
            <div
              key={p.id}
              className="space-y-3 rounded-lg border border-fcb-border bg-fcb-surface p-4 text-fcb-text"
            >
              <div>
                <p className="text-base font-semibold">
                  {p.vorname} {p.nachname}
                </p>

                <p className="text-xs text-fcb-muted">
                  {ROLLEN_LABEL[p.rolle] ?? p.rolle}
                </p>
              </div>

              {p.telefonnummer && (
                <p className="flex items-center gap-2 text-sm">
                  <Phone size={16} aria-hidden className="shrink-0 text-fcb-muted" />
                  <a
                    href={`tel:${p.telefonnummer}`}
                    className="hover:text-fcb-accent hover:underline"
                  >
                    {p.telefonnummer}
                  </a>
                </p>
              )}

              {p.mannschaft && p.mannschaft.length > 0 && (
                <p className="flex items-start gap-2 text-sm text-fcb-muted">
                  <Users size={16} aria-hidden className="mt-0.5 shrink-0" />
                  <span>{p.mannschaft.join(", ")}</span>
                </p>
              )}

              {hatAdresse && (
                <p className="flex items-start gap-2 text-sm text-fcb-muted">
                  <MapPin size={16} aria-hidden className="mt-0.5 shrink-0" />
                  <span>
                    {p.strasse && <span className="block">{p.strasse}</span>}
                    {adresszeile && <span className="block">{adresszeile}</span>}
                  </span>
                </p>
              )}

              {!hatKontaktinfos && (
                <p className="text-sm italic text-fcb-muted">
                  Keine weiteren Kontaktinfos
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
