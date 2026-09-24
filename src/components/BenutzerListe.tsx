"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { ChevronDown, ChevronUp } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Banner from "@/components/ui/Banner";
import Button from "@/components/ui/Button";
import {
  getTeamAccent,
  TRAEGER_INFO,
  type Traeger,
} from "@/lib/teams";

type Nutzer = {
  id: string;
  vorname: string;
  nachname: string;
  telefonnummer: string | null;
  rolle: string;
  mannschaft: string[] | null;
  verein: string[];
};


interface BenutzerListeProps {
  eigeneRolle: string;
}

// mitglied ergänzt gegenüber bisherigem Stand
const ROLLEN_OPTIONEN: Record<string, string[]> = {
  vorstand: ["ausstehend", "trainer", "mitglied"],
  admin: ["ausstehend", "trainer", "mitglied", "vorstand", "admin"],
};

// Rollen-Badge-Mapping: Farbe kommuniziert Status auf einen Blick
type BadgeVariant = "yellow" | "blue" | "green" | "purple" | "red" | "neutral";
const ROLLEN_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  ausstehend: { label: "Ausstehend", variant: "yellow" },
  mitglied:   { label: "Mitglied",   variant: "blue" },
  trainer:    { label: "Trainer",    variant: "green" },
  vorstand:   { label: "Vorstand",   variant: "purple" },
  admin:      { label: "Admin",      variant: "red" },
};

const VEREINS_OPTIONEN = ["fcb", "jfg"] as const satisfies readonly Traeger[];

function istTraeger(wert: string): wert is Traeger {
  return VEREINS_OPTIONEN.some((verein) => verein === wert);
}

function VereinsBadges({ vereine }: { vereine: string[] }) {
  const gueltigeVereine = vereine.filter(istTraeger);

  if (gueltigeVereine.length === 0) {
    return <Badge variant="neutral">Kein Verein</Badge>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {gueltigeVereine.map((verein) => {
        const info = TRAEGER_INFO[verein];
        const accent = getTeamAccent(verein);
        return (
          <span
            key={verein}
            title={info.name}
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-inter text-xs font-medium ${accent.badge}`}
          >
            {info.label}
            <span className="sr-only"> – {info.name}</span>
          </span>
        );
      })}
    </div>
  );
}

function VereinsAuswahl({
  nutzer,
  onAendern,
  disabled = false,
}: {
  nutzer: Nutzer;
  onAendern: (verein: Traeger, ausgewaehlt: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset
      aria-busy={disabled}
      className="rounded-lg border border-fcb-border bg-fcb-bg px-2.5 py-1.5"
    >
      <legend className="px-1 font-inter text-xs font-medium uppercase tracking-wider text-fcb-muted">
        Verein<span className="sr-only"> für {nutzer.vorname} {nutzer.nachname}</span>
      </legend>
      <div className="flex items-center gap-3">
        {VEREINS_OPTIONEN.map((verein) => {
          const info = TRAEGER_INFO[verein];
          const accent = getTeamAccent(verein);
          const ausgewaehlt = nutzer.verein.includes(verein);
          return (
            <label
              key={verein}
              title={info.name}
              className={`inline-flex items-center gap-1.5 font-inter text-xs ${
                ausgewaehlt ? accent.text : "text-fcb-muted"
              } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                checked={ausgewaehlt}
                disabled={disabled}
                onChange={(event) => onAendern(verein, event.target.checked)}
                className="h-4 w-4 rounded border-fcb-border accent-fcb-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent"
              />
              {info.label}
              <span className="sr-only"> – {info.name}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function BenutzerListe({ eigeneRolle }: BenutzerListeProps) {
  const supabase = createClient();
  // Mannschaftsanfragen wurden in MannschaftsanfragenVerwaltung.tsx ausgelagert
  const [nutzer, setNutzer] = useState<Nutzer[]>([]);
  const [suche, setSuche] = useState("");
  const [expandedUserIds, setExpandedUserIds] = useState<string[]>([]);
  const [fehler, setFehler] = useState("");
  const [erfolg, setErfolg] = useState("");
  const [vereinSpeichertIds, setVereinSpeichertIds] = useState<string[]>([]);

  useEffect(() => {
    ladeNutzer();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ladeNutzer = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, vorname, nachname, telefonnummer, rolle, mannschaft, verein")
      .order("nachname");

    if (error) {
      setFehler("Fehler beim Laden der Nutzerliste: " + error.message);
      return;
    }

    setNutzer(data ?? []);
  };

  const rolleAendern = async (userId: string, neueRolle: string) => {
    const erlaubteRollen = ROLLEN_OPTIONEN[eigeneRolle] ?? [];
    if (!erlaubteRollen.includes(neueRolle)) {
      setFehler("Du darfst diese Rolle nicht vergeben.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ rolle: neueRolle })
      .eq("id", userId);

    if (error) {
      setFehler("Fehler beim Ändern der Rolle: " + error.message);
    } else {
      setErfolg("Rolle erfolgreich geändert.");
      ladeNutzer();
    }
  };

  const vereinAendern = async (
    userId: string,
    verein: Traeger,
    ausgewaehlt: boolean
  ) => {
    if (eigeneRolle !== "admin") {
      setFehler("Nur Admins dürfen Vereinszuordnungen ändern.");
      return;
    }
    if (vereinSpeichertIds.includes(userId)) return;
    setFehler("");
    setErfolg("");

    const betroffenerNutzer = nutzer.find((eintrag) => eintrag.id === userId);
    if (!betroffenerNutzer) return;

    const bisherigeVereine = new Set(betroffenerNutzer.verein.filter(istTraeger));
    if (ausgewaehlt) {
      bisherigeVereine.add(verein);
    } else {
      bisherigeVereine.delete(verein);
    }
    const neueVereine = VEREINS_OPTIONEN.filter((option) =>
      bisherigeVereine.has(option)
    );

    // Pro Nutzer ist nur ein Vereins-Update gleichzeitig erlaubt, damit zwei
    // schnelle Checkbox-Klicks nicht denselben veralteten Ausgangswert nutzen.
    setVereinSpeichertIds((ids) => [...ids, userId]);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ verein: neueVereine })
        .eq("id", userId);

      if (error) {
        setFehler("Fehler beim Ändern der Vereinszuordnung: " + error.message);
      } else {
        setErfolg("Vereinszuordnung erfolgreich geändert.");
        await ladeNutzer();
      }
    } catch (error) {
      const meldung =
        error instanceof Error ? error.message : "Unbekannter Fehler";
      setFehler("Fehler beim Ändern der Vereinszuordnung: " + meldung);
    } finally {
      setVereinSpeichertIds((ids) => ids.filter((id) => id !== userId));
    }
  };

  const ablehnen = async (userId: string, name: string) => {
    if (!confirm(`Nutzer ${name} wirklich ablehnen und Konto löschen?`)) return;

    // Access-Token mitschicken, damit die Route serverseitig prüfen kann,
    // wer den Aufruf macht (Sicherheitsfix 2026-08-12).
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setFehler("Nicht angemeldet – bitte neu einloggen.");
      return;
    }

    const res = await fetch("/api/benutzer-ablehnen", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ userId }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFehler("Fehler beim Ablehnen: " + (body.error ?? res.statusText));
    } else {
      setErfolg(`Nutzer ${name} wurde abgelehnt und gelöscht.`);
      ladeNutzer();
    }
  };

  const toggleDetails = (id: string) => {
    setExpandedUserIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  const ausstehende = nutzer.filter((n) => n.rolle === "ausstehend");
  const aktive = nutzer.filter((n) => n.rolle !== "ausstehend");
  const gefilterteAktive = aktive.filter((n) =>
    `${n.vorname} ${n.nachname}`.toLowerCase().includes(suche.toLowerCase())
  );

  const erlaubteRollen = ROLLEN_OPTIONEN[eigeneRolle] ?? [];

  return (
    <div className="space-y-8">
      {fehler && (
        <p className="font-inter text-sm p-3 border border-fcb-red/40 rounded-lg bg-fcb-red/10 text-fcb-red">
          {fehler}
        </p>
      )}
      {erfolg && (
        <p className="font-inter text-sm p-3 border border-green-500/40 rounded-lg bg-green-500/10 text-green-500">
          {erfolg}
        </p>
      )}

      {eigeneRolle === "admin" && (
        <Banner
          variant="info"
          message="Die Vereinszuordnung steuert die Mitgliederverwaltung: Vorstände sehen und verwalten dort nur Mitglieder der hier zugeordneten Vereine. Die Nutzerliste auf dieser Seite ist davon nicht betroffen."
        />
      )}

      {/* Ausstehende Anfragen */}
      {ausstehende.length > 0 && (
        <section>
          <h2 className="font-oswald text-lg font-semibold uppercase tracking-wide text-fcb-text mb-3">
            Ausstehende Anfragen ({ausstehende.length})
          </h2>
          <div className="space-y-3">
            {ausstehende.map((n) => (
              <div
                key={n.id}
                className="border border-yellow-500/40 rounded-xl p-4 bg-yellow-500/10"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="font-inter font-semibold text-fcb-text">
                      {n.vorname} {n.nachname}
                    </p>
                    {n.telefonnummer && (
                      <p className="font-inter text-sm text-fcb-muted">
                        Telefon: {n.telefonnummer}
                      </p>
                    )}
                    {n.mannschaft && n.mannschaft.length > 0 && (
                      <p className="font-inter text-sm text-fcb-muted">
                        Mannschaft(en): {n.mannschaft.join(", ")}
                      </p>
                    )}
                    <div className="mt-2">
                      <VereinsBadges vereine={n.verein} />
                    </div>
                  </div>
                  {/* Dropdown statt fester Buttons – freischalten geschieht implizit
                      durch Auswahl einer Nicht-ausstehend-Rolle. ROLLEN_OPTIONEN
                      enthält "ausstehend" für beide Rollen, daher immer sichtbar. */}
                  <div className="flex flex-wrap items-end gap-2">
                    {eigeneRolle === "admin" && (
                      <VereinsAuswahl
                        nutzer={n}
                        disabled={vereinSpeichertIds.includes(n.id)}
                        onAendern={(verein, ausgewaehlt) =>
                          vereinAendern(n.id, verein, ausgewaehlt)
                        }
                      />
                    )}
                    {/* w-36 entspricht der festen Breite im "Aktive Nutzer"-Block */}
                    <select
                      value={n.rolle}
                      onChange={(e) => rolleAendern(n.id, e.target.value)}
                      aria-label={`Rolle für ${n.vorname} ${n.nachname} ändern`}
                      className="w-36 rounded-lg border border-fcb-border bg-fcb-bg px-2 py-1.5 font-inter text-sm text-fcb-text focus:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent/40 focus:border-fcb-accent"
                    >
                      {erlaubteRollen.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => ablehnen(n.id, `${n.vorname} ${n.nachname}`)}
                    >
                      Ablehnen
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Aktive Nutzer */}
      <section>
        <h2 className="font-oswald text-lg font-semibold uppercase tracking-wide text-fcb-text mb-3">
          Aktive Nutzer ({aktive.length})
        </h2>

        {/* Suchfeld retokenisiert – kein .form-field mehr */}
        <input
          type="text"
          aria-label="Nutzer suchen"
          placeholder="Nutzer suchen …"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          className="w-full rounded-lg border border-fcb-border bg-fcb-bg px-3 py-2.5 font-inter text-sm text-fcb-text placeholder:text-fcb-muted/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent/40 focus:border-fcb-accent mb-4"
        />

        <div className="space-y-3">
          {gefilterteAktive.map((n) => (
            <div
              key={n.id}
              className="border border-fcb-border rounded-xl p-4 bg-fcb-surface hover:bg-fcb-border/40 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-inter font-semibold text-fcb-text">
                    {n.vorname} {n.nachname}
                  </p>
                  {/* Rolle als Badge – visuell konsistent mit ROLLEN_BADGE-Mapping */}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant={(ROLLEN_BADGE[n.rolle]?.variant) ?? "neutral"}>
                      {ROLLEN_BADGE[n.rolle]?.label ?? n.rolle}
                    </Badge>
                    <VereinsBadges vereine={n.verein} />
                  </div>
                  {n.rolle === "vorstand" && n.verein.length === 0 && (
                    <div className="mt-2 max-w-md">
                      <Banner
                        variant="warning"
                        message="Kein Verein zugeordnet – sieht keine Mitglieder."
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {eigeneRolle === "admin" && (
                    <VereinsAuswahl
                      nutzer={n}
                      disabled={vereinSpeichertIds.includes(n.id)}
                      onAendern={(verein, ausgewaehlt) =>
                        vereinAendern(n.id, verein, ausgewaehlt)
                      }
                    />
                  )}
                  <button
                    onClick={() => toggleDetails(n.id)}
                    aria-expanded={expandedUserIds.includes(n.id)}
                    aria-controls={`nutzer-details-${n.id}`}
                    className="font-inter text-sm text-fcb-muted hover:text-fcb-text transition-colors flex items-center gap-1"
                  >
                    {expandedUserIds.includes(n.id) ? (
                      <>Details ausblenden <ChevronUp aria-hidden className="w-4 h-4" /></>
                    ) : (
                      <>Weitere Infos <ChevronDown aria-hidden className="w-4 h-4" /></>
                    )}
                  </button>

                  {/*
                    Dropdown nur anzeigen, wenn die aktuelle Rolle des Nutzers
                    auch tatsächlich von der eingeloggten Person geändert werden
                    darf. Sonst Badge: ein vorstand-User darf z. B. einen admin
                    nicht herabstufen – ohne diesen Guard würde das <select>
                    fälschlich auf die erste Option ("ausstehend") zurückfallen.
                    Der w-36-Container stellt sicher, dass "Weitere Infos" in
                    jeder Zeile exakt auf derselben horizontalen Position bleibt,
                    egal ob Dropdown (breiter) oder Badge (schmaler) gezeigt wird.
                  */}
                  <div className="w-36 flex items-center">
                    {erlaubteRollen.includes(n.rolle) ? (
                      <select
                        value={n.rolle}
                        onChange={(e) => rolleAendern(n.id, e.target.value)}
                        aria-label={`Rolle für ${n.vorname} ${n.nachname} ändern`}
                        className="w-full rounded-lg border border-fcb-border bg-fcb-bg px-2 py-1.5 font-inter text-sm text-fcb-text focus:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent/40 focus:border-fcb-accent"
                      >
                        {erlaubteRollen.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      // Nicht-änderbarer Badge für Rollen außerhalb der eigenen Berechtigung
                      // (z. B. vorstand sieht admin-Badge, kann ihn nicht ändern)
                      <span title="Diese Rolle kannst du nicht ändern">
                        <Badge variant={(ROLLEN_BADGE[n.rolle]?.variant) ?? "neutral"}>
                          {ROLLEN_BADGE[n.rolle]?.label ?? n.rolle}
                        </Badge>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {expandedUserIds.includes(n.id) && (
                <div
                  id={`nutzer-details-${n.id}`}
                  className="mt-3 font-inter text-sm space-y-1 text-fcb-muted"
                >
                  {n.telefonnummer && <p>Telefon: {n.telefonnummer}</p>}
                  {n.mannschaft && n.mannschaft.length > 0 && (
                    <p>Mannschaft(en): {n.mannschaft.join(", ")}</p>
                  )}
                  {!n.telefonnummer && (!n.mannschaft || n.mannschaft.length === 0) && (
                    <p className="italic text-fcb-muted/60">Keine weiteren Informationen vorhanden.</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {gefilterteAktive.length === 0 && (
            <p className="font-inter text-sm italic text-center text-fcb-muted py-8">
              Keine Nutzer gefunden.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
