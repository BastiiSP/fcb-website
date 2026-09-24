"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabaseClient";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import LoeschenModal from "@/components/LoeschenModal";
import MitgliedBearbeitenModal, {
  type Mitglied,
  type VerwaltungsRolle,
} from "@/components/MitgliedBearbeitenModal";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import TextField from "@/components/ui/TextField";
import Select from "@/components/ui/Select";
import {
  getTeamAccent,
  TRAEGER_INFO,
  type Traeger,
} from "@/lib/teams";

interface Props {
  eigeneUserId: string;
}

// Status-Werte als Konstante – müssen mit dem DB-CHECK-Constraint übereinstimmen
const STATUS_OPTIONEN = ["aktiv", "passiv", "ehrenamt", "gekündigt"] as const;
const VEREINS_OPTIONEN = ["fcb", "jfg"] as const satisfies readonly Traeger[];

function istTraeger(wert: string): wert is Traeger {
  return VEREINS_OPTIONEN.some((verein) => verein === wert);
}

function VereinsBadges({ vereine }: { vereine: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {vereine.filter(istTraeger).map((verein) => {
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

// Status → Badge-Variante gemäß Design-Spec
function statusBadgeVariant(
  status: Mitglied["status"]
): "green" | "neutral" | "blue" | "red" {
  switch (status) {
    case "aktiv":
      return "green";
    case "passiv":
      return "neutral";
    case "ehrenamt":
      return "blue";
    case "gekündigt":
      return "red";
  }
}

export default function MitgliederVerwaltung({ eigeneUserId }: Props) {
  const supabase = createClient();

  const [mitglieder, setMitglieder] = useState<Mitglied[]>([]);
  const [laden, setLaden] = useState(true);
  const [berechtigungGeladen, setBerechtigungGeladen] = useState(false);
  const [fehler, setFehler] = useState("");
  const [erfolg, setErfolg] = useState("");
  const [eigeneRolle, setEigeneRolle] = useState<VerwaltungsRolle | null>(null);
  const [eigeneVereine, setEigeneVereine] = useState<string[]>([]);

  // Filter- und Suchfelder
  const [suche, setSuche] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMannschaft, setFilterMannschaft] = useState("");

  // Modal-Zustände
  const [bearbeitenMitglied, setBearbeitenMitglied] =
    useState<Mitglied | null>(null);
  const [hinzufuegenOffen, setHinzufuegenOffen] = useState(false);
  const [loeschenMitglied, setLoeschenMitglied] = useState<Mitglied | null>(
    null
  );

  useEffect(() => {
    ladeMitglieder();
    ladeEigeneBerechtigung();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Erfolgsmeldung nach 3 Sekunden automatisch ausblenden
  useEffect(() => {
    if (!erfolg) return;
    const t = setTimeout(() => setErfolg(""), 3000);
    return () => clearTimeout(t);
  }, [erfolg]);

  const ladeMitglieder = async () => {
    setLaden(true);
    // RLS stellt sicher, dass nur vorstand/admin diese Daten sehen können
    const { data, error } = await supabase
      .from("mitglieder")
      .select(
        "id, mitgliedsnummer, vorname, nachname, email, telefonnummer, geburtsdatum, eintrittsdatum, status, mannschaft, verein, notizen, erstellt_von, created_at, updated_at"
      )
      .order("nachname");

    if (error) {
      setFehler("Fehler beim Laden der Mitglieder: " + error.message);
    } else {
      setMitglieder((data as Mitglied[]) ?? []);
    }
    setLaden(false);
  };

  const ladeEigeneBerechtigung = async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw new Error(authError.message);
      if (!user) throw new Error("Keine aktive Anmeldung gefunden.");

      const { data, error } = await supabase
        .from("profiles")
        .select("rolle, verein")
        .eq("id", user.id)
        .single();

      if (error) throw new Error(error.message);
      const profil = data as { rolle: string; verein: string[] | null };
      if (profil.rolle !== "admin" && profil.rolle !== "vorstand") {
        throw new Error("Deine Rolle darf keine Mitglieder verwalten.");
      }

      // Die Zuweisungsoptionen kommen bewusst aus dem eigenen Profil statt
      // aus der Domain, weil Vorstände nur ihre hinterlegten Vereine verwalten.
      setEigeneRolle(profil.rolle);
      setEigeneVereine((profil.verein ?? []).filter(istTraeger));
    } catch (error) {
      const meldung =
        error instanceof Error ? error.message : "Unbekannter Fehler";
      setFehler("Fehler beim Laden deiner Vereinsberechtigung: " + meldung);
    } finally {
      setBerechtigungGeladen(true);
    }
  };

  const loeschenBestaetigen = async () => {
    if (!loeschenMitglied) return;

    const { error } = await supabase
      .from("mitglieder")
      .delete()
      .eq("id", loeschenMitglied.id);

    if (error) {
      setFehler("Fehler beim Löschen: " + error.message);
    } else {
      setErfolg(
        `${loeschenMitglied.vorname} ${loeschenMitglied.nachname} wurde gelöscht.`
      );
      ladeMitglieder();
    }
    setLoeschenMitglied(null);
  };

  // Alle einzigartigen Mannschaften aus den Daten – für den Mannschafts-Filter
  const alleMannschaften = useMemo(() => {
    const set = new Set<string>();
    mitglieder.forEach((m) => m.mannschaft?.forEach((ms) => set.add(ms)));
    return Array.from(set).sort();
  }, [mitglieder]);

  // Client-seitige Filterung: Suche über Name + E-Mail, plus Status- und Mannschaftsfilter
  const gefiltert = useMemo(() => {
    const suchLower = suche.toLowerCase();
    return mitglieder.filter((m) => {
      const trefferSuche =
        !suche ||
        `${m.vorname} ${m.nachname}`.toLowerCase().includes(suchLower) ||
        (m.email ?? "").toLowerCase().includes(suchLower);
      const trefferStatus = !filterStatus || m.status === filterStatus;
      const trefferMannschaft =
        !filterMannschaft ||
        (m.mannschaft ?? []).includes(filterMannschaft);
      return trefferSuche && trefferStatus && trefferMannschaft;
    });
  }, [mitglieder, suche, filterStatus, filterMannschaft]);

  // CSV-Export: UTF-8 BOM (﻿) für korrekte Umlaut-Anzeige in Excel
  const csvExportieren = () => {
    const kopfzeile = [
      "Mitgliedsnummer",
      "Vorname",
      "Nachname",
      "E-Mail",
      "Telefon",
      "Geburtsdatum",
      "Eintrittsdatum",
      "Status",
      "Verein(e)",
      "Mannschaft(en)",
      "Notizen",
    ];

    const zeilen = mitglieder.map((m) => [
      m.mitgliedsnummer,
      m.vorname,
      m.nachname,
      m.email ?? "",
      m.telefonnummer ?? "",
      m.geburtsdatum ?? "",
      m.eintrittsdatum ?? "",
      m.status,
      m.verein
        .map((verein) =>
          istTraeger(verein) ? TRAEGER_INFO[verein].label : verein
        )
        .join("; "),
      m.mannschaft?.join("; ") ?? "",
      m.notizen ?? "",
    ]);

    // Jede Zelle in Anführungszeichen – schützt vor Kommas und Zeilenumbrüchen in Feldern
    const csvInhalt = [kopfzeile, ...zeilen]
      .map((zeile) =>
        zeile
          .map((zelle) => {
            // CSV-/Formel-Injection (CWE-1236): Beginnt ein Wert mit = + - @ oder
            // Tab/CR, würde Excel ihn als Formel ausführen – mit ' neutralisieren.
            const wert = String(zelle);
            const sicher = /^[=+\-@\t\r]/.test(wert) ? `'${wert}` : wert;
            return `"${sicher.replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\n");

    const dateiname = `mitglieder_${new Date().toISOString().slice(0, 10)}.csv`;
    const blob = new Blob(["﻿" + csvInhalt], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = dateiname;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (laden || !berechtigungGeladen) {
    return (
      <p className="text-center font-inter text-fcb-muted mt-8">Lade Mitgliederliste …</p>
    );
  }

  if (!eigeneRolle) {
    return (
      <p className="rounded-lg border border-fcb-red/40 bg-fcb-red/10 p-3 font-inter text-sm text-fcb-red">
        {fehler || "Die Vereinsberechtigung konnte nicht geladen werden."}
      </p>
    );
  }

  // Status-Optionen für das Select-Primitive (leere Option = "Alle")
  const statusSelectOptionen = [
    { value: "", label: "Alle Status" },
    ...STATUS_OPTIONEN.map((s) => ({
      value: s,
      label: s.charAt(0).toUpperCase() + s.slice(1),
    })),
  ];

  // Mannschafts-Optionen für das Select-Primitive
  const mannschaftSelectOptionen = [
    { value: "", label: "Alle Mannschaften" },
    ...alleMannschaften.map((ms) => ({ value: ms, label: ms })),
  ];

  return (
    <div className="space-y-6">
      {/* Rückmeldungen */}
      {fehler && (
        <p className="font-inter text-sm text-fcb-red p-3 border border-fcb-red/40 rounded-lg bg-fcb-red/10">
          {fehler}
        </p>
      )}
      {erfolg && (
        <p className="font-inter text-sm text-green-500 p-3 border border-green-500/40 rounded-lg bg-green-500/10">
          {erfolg}
        </p>
      )}

      {/* Aktionsleiste: Suche + Filter + Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-end">
        {/* TextField übernimmt die Suche – label ist screen-reader-sichtbar */}
        <div className="sm:flex-1">
          <TextField
            label="Suche"
            value={suche}
            onChange={setSuche}
            placeholder="Name oder E-Mail suchen …"
          />
        </div>

        <div className="sm:w-44">
          <Select
            label="Status"
            value={filterStatus}
            onChange={setFilterStatus}
            options={statusSelectOptionen}
          />
        </div>

        {alleMannschaften.length > 0 && (
          <div className="sm:w-52">
            <Select
              label="Mannschaft"
              value={filterMannschaft}
              onChange={setFilterMannschaft}
              options={mannschaftSelectOptionen}
            />
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="primary"
            onClick={() => setHinzufuegenOffen(true)}
            disabled={eigeneRolle === "vorstand" && eigeneVereine.length === 0}
            title={
              eigeneRolle === "vorstand" && eigeneVereine.length === 0
                ? "Deinem Profil ist kein Verein zugeordnet."
                : undefined
            }
          >
            <Plus size={16} aria-hidden />
            Mitglied hinzufügen
          </Button>

          <Button
            variant="secondary"
            onClick={csvExportieren}
            title="Alle Mitglieder als CSV exportieren"
          >
            <Download size={16} aria-hidden />
            Als CSV exportieren
          </Button>
        </div>
      </div>

      {/* Ergebniszähler */}
      <p className="font-inter text-sm text-fcb-muted">
        {gefiltert.length} von {mitglieder.length} Mitglied
        {mitglieder.length !== 1 ? "er" : ""}
      </p>

      {/* Tabelle */}
      {gefiltert.length === 0 ? (
        <p className="font-inter text-center italic text-fcb-muted mt-6">
          Keine Mitglieder gefunden.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-fcb-border bg-fcb-surface">
          <table className="w-full text-sm border-collapse">
            <thead>
              {/* Header-Zeile: muted + uppercase per Design-Spec */}
              <tr className="border-b border-fcb-border text-left">
                <th className="py-3 px-4 font-inter text-xs font-medium uppercase tracking-wider text-fcb-muted">Nr.</th>
                <th className="py-3 px-4 font-inter text-xs font-medium uppercase tracking-wider text-fcb-muted">Name</th>
                <th className="py-3 px-4 font-inter text-xs font-medium uppercase tracking-wider text-fcb-muted hidden sm:table-cell">
                  E-Mail
                </th>
                <th className="py-3 px-4 font-inter text-xs font-medium uppercase tracking-wider text-fcb-muted hidden md:table-cell">
                  Verein
                </th>
                <th className="py-3 px-4 font-inter text-xs font-medium uppercase tracking-wider text-fcb-muted hidden md:table-cell">
                  Status
                </th>
                <th className="py-3 px-4 font-inter text-xs font-medium uppercase tracking-wider text-fcb-muted hidden lg:table-cell">
                  Mannschaft(en)
                </th>
                <th className="py-3 px-4 font-inter text-xs font-medium uppercase tracking-wider text-fcb-muted text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {gefiltert.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-fcb-border hover:bg-fcb-border/40 transition-colors"
                >
                  <td className="py-3 px-4 font-inter text-fcb-muted">{m.mitgliedsnummer}</td>
                  <td className="py-3 px-4 font-inter font-medium text-fcb-text">
                    {m.nachname}, {m.vorname}
                    <div className="mt-1 md:hidden">
                      <VereinsBadges vereine={m.verein} />
                    </div>
                  </td>
                  <td className="py-3 px-4 font-inter text-fcb-text hidden sm:table-cell">
                    {m.email ?? "–"}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <VereinsBadges vereine={m.verein} />
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <Badge variant={statusBadgeVariant(m.status)}>
                      {m.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 font-inter text-fcb-muted hidden lg:table-cell">
                    {m.mannschaft?.join(", ") ?? "–"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      {/* Icon-Buttons: ghost-Stil ohne Button-Primitive um Padding schlank zu halten */}
                      <button
                        onClick={() => setBearbeitenMitglied(m)}
                        aria-label={`${m.vorname} ${m.nachname} bearbeiten`}
                        className="p-1.5 rounded text-fcb-muted hover:text-fcb-text hover:bg-fcb-border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent"
                        title="Bearbeiten"
                      >
                        <Pencil size={16} aria-hidden />
                      </button>
                      <button
                        onClick={() => setLoeschenMitglied(m)}
                        aria-label={`${m.vorname} ${m.nachname} löschen`}
                        className="p-1.5 rounded text-fcb-muted hover:text-fcb-red hover:bg-fcb-red/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-fcb-red"
                        title="Löschen"
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Hinzufügen */}
      <MitgliedBearbeitenModal
        show={hinzufuegenOffen}
        onClose={() => setHinzufuegenOffen(false)}
        supabase={supabase}
        initialData={null}
        onSave={() => {
          setErfolg("Mitglied erfolgreich hinzugefügt.");
          ladeMitglieder();
        }}
        eigeneUserId={eigeneUserId}
        eigeneRolle={eigeneRolle}
        eigeneVereine={eigeneVereine}
      />

      {/* Modal: Bearbeiten */}
      <MitgliedBearbeitenModal
        show={bearbeitenMitglied !== null}
        onClose={() => setBearbeitenMitglied(null)}
        supabase={supabase}
        initialData={bearbeitenMitglied}
        onSave={() => {
          setErfolg("Mitglied erfolgreich aktualisiert.");
          ladeMitglieder();
        }}
        eigeneUserId={eigeneUserId}
        eigeneRolle={eigeneRolle}
        eigeneVereine={eigeneVereine}
      />

      {/* Modal: Löschen – nutzt erweitertes LoeschenModal mit eigenen Texten */}
      <LoeschenModal
        show={loeschenMitglied !== null}
        onClose={() => setLoeschenMitglied(null)}
        onConfirm={loeschenBestaetigen}
        titel="Mitglied löschen"
        beschreibung={
          loeschenMitglied
            ? `Möchtest du ${loeschenMitglied.vorname} ${loeschenMitglied.nachname} wirklich aus der Mitgliederliste entfernen? Diese Aktion kann nicht rückgängig gemacht werden.`
            : undefined
        }
      />
    </div>
  );
}
