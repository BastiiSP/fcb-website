"use client";

import React, { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useTenant } from "@/components/tenant/TenantProvider";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import TextField from "@/components/ui/TextField";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import {
  getTeamAccent,
  TRAEGER_INFO,
  type Traeger,
} from "@/lib/teams";

// Typdefinition für ein Vereinsmitglied – spiegelt das DB-Schema der mitglieder-Tabelle
export type Mitglied = {
  id: string;
  mitgliedsnummer: number;
  vorname: string;
  nachname: string;
  email: string | null;
  telefonnummer: string | null;
  geburtsdatum: string | null;
  eintrittsdatum: string | null;
  status: "aktiv" | "passiv" | "ehrenamt" | "gekündigt";
  mannschaft: string[] | null;
  verein: string[];
  notizen: string | null;
  erstellt_von: string | null;
  created_at: string;
  updated_at: string;
};

// Formular-State ist losgelöst vom vollen Mitglied-Typ (keine Auto-Felder, kein mitgliedsnummer-Input)
type MitgliedFormData = {
  vorname: string;
  nachname: string;
  email: string;
  telefonnummer: string;
  geburtsdatum: string;
  eintrittsdatum: string;
  status: "aktiv" | "passiv" | "ehrenamt" | "gekündigt";
  mannschaftText: string; // Kommagetrennte Eingabe, wird beim Speichern in TEXT[] konvertiert
  verein: Traeger[];
  notizen: string;
};

type MitgliedTextFeld = Exclude<keyof MitgliedFormData, "verein">;

const LEERES_FORMULAR: MitgliedFormData = {
  vorname: "",
  nachname: "",
  email: "",
  telefonnummer: "",
  geburtsdatum: "",
  eintrittsdatum: "",
  status: "aktiv",
  mannschaftText: "",
  verein: [],
  notizen: "",
};

// Status-Optionen für das Select-Primitive
const STATUS_SELECT_OPTIONEN = [
  { value: "aktiv", label: "Aktiv" },
  { value: "passiv", label: "Passiv" },
  { value: "ehrenamt", label: "Ehrenamt" },
  { value: "gekündigt", label: "Gekündigt" },
];

const VEREINS_OPTIONEN = ["fcb", "jfg"] as const satisfies readonly Traeger[];

function istTraeger(wert: string): wert is Traeger {
  return VEREINS_OPTIONEN.some((verein) => verein === wert);
}

export type VerwaltungsRolle = "admin" | "vorstand";

type Props = {
  show: boolean;
  onClose: () => void;
  supabase: ReturnType<typeof createClient>;
  initialData: Mitglied | null; // null = Hinzufügen-Modus, Objekt = Bearbeiten-Modus
  onSave: () => void;
  eigeneUserId: string; // wird beim INSERT als erstellt_von gesetzt
  eigeneRolle: VerwaltungsRolle;
  eigeneVereine: string[];
};

export default function MitgliedBearbeitenModal({
  show,
  onClose,
  supabase,
  initialData,
  onSave,
  eigeneUserId,
  eigeneRolle,
  eigeneVereine,
}: Props) {
  const tenant = useTenant();
  const vereinFehlerId = useId();
  const [form, setForm] = useState<MitgliedFormData>(LEERES_FORMULAR);
  const [fehler, setFehler] = useState("");
  const [vereinFehler, setVereinFehler] = useState("");
  const [speichert, setSpeichert] = useState(false);

  // Formular befüllen wenn Modal geöffnet wird – leeren bei Hinzufügen-Modus
  useEffect(() => {
    if (!show) return;
    if (initialData) {
      setForm({
        vorname: initialData.vorname,
        nachname: initialData.nachname,
        email: initialData.email ?? "",
        telefonnummer: initialData.telefonnummer ?? "",
        geburtsdatum: initialData.geburtsdatum ?? "",
        eintrittsdatum: initialData.eintrittsdatum ?? "",
        status: initialData.status,
        mannschaftText: initialData.mannschaft?.join(", ") ?? "",
        verein: initialData.verein.filter(istTraeger),
        notizen: initialData.notizen ?? "",
      });
    } else {
      const darfAktuellenTenantZuweisen =
        eigeneRolle === "admin" || eigeneVereine.includes(tenant.id);
      setForm({
        ...LEERES_FORMULAR,
        // Der aktuelle Auftritt ist nur dann ein sicherer Default, wenn die
        // eingeloggte Person diesen Verein laut Profil zuweisen darf.
        verein: darfAktuellenTenantZuweisen ? [tenant.id] : [],
      });
    }
    setFehler("");
    setVereinFehler("");
  }, [show, initialData, eigeneRolle, eigeneVereine, tenant.id]);

  const handleChange = (
    field: MitgliedTextFeld,
    value: string
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const darfVereinZuweisen = (verein: Traeger) =>
    eigeneRolle === "admin" || eigeneVereine.includes(verein);

  const vereinUmschalten = (verein: Traeger) => {
    // Die UI spiegelt den DB-Trigger: Vorstände dürfen fremde Zuordnungen
    // weder ergänzen noch von einem bestehenden Mitglied entfernen.
    if (!darfVereinZuweisen(verein)) return;
    setForm((prev) => ({
      ...prev,
      verein: prev.verein.includes(verein)
        ? prev.verein.filter((eintrag) => eintrag !== verein)
        : [...prev.verein, verein],
    }));
    setVereinFehler("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vorname.trim() || !form.nachname.trim()) {
      setFehler("Vorname und Nachname sind Pflichtfelder.");
      return;
    }
    if (form.verein.length === 0) {
      setVereinFehler("Bitte mindestens einen Verein auswählen.");
      return;
    }
    if (
      eigeneRolle === "vorstand" &&
      !form.verein.some((verein) => darfVereinZuweisen(verein))
    ) {
      setVereinFehler(
        "Bitte mindestens einen Verein auswählen, den du verwalten darfst."
      );
      return;
    }

    setSpeichert(true);
    setFehler("");

    // Kommagetrennte Mannschaftsliste → getrimmtes Array (leere Strings herausfiltern)
    const mannschaftArray = form.mannschaftText
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const payload = {
      vorname: form.vorname.trim(),
      nachname: form.nachname.trim(),
      email: form.email.trim() || null,
      telefonnummer: form.telefonnummer.trim() || null,
      geburtsdatum: form.geburtsdatum || null,
      eintrittsdatum: form.eintrittsdatum || null,
      status: form.status,
      mannschaft: mannschaftArray.length > 0 ? mannschaftArray : null,
      verein: form.verein,
      notizen: form.notizen.trim() || null,
    };

    const { error } = initialData
      ? await supabase
        .from("mitglieder")
        .update(payload)
        .eq("id", initialData.id)
      : await supabase
        .from("mitglieder")
        // erstellt_von hält die fachliche Herkunft fest; die Berechtigung
        // selbst wird weiterhin ausschließlich durch RLS entschieden.
        .insert({ ...payload, erstellt_von: eigeneUserId });

    setSpeichert(false);

    if (error) {
      setFehler("Fehler beim Speichern: " + error.message);
    } else {
      onSave();
      onClose();
    }
  };

  const istBearbeiten = initialData !== null;

  return (
    <Modal
      open={show}
      onClose={onClose}
      title={istBearbeiten ? "Mitglied bearbeiten" : "Mitglied hinzufügen"}
      size="lg"
    >
      {fehler && (
        <p className="font-inter text-sm text-fcb-red p-3 border border-fcb-red/40 rounded-lg bg-fcb-red/10 mb-4">
          {fehler}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Pflichtfelder */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <TextField
              label="Vorname"
              value={form.vorname}
              onChange={(v) => handleChange("vorname", v)}
              required
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <TextField
              label="Nachname"
              value={form.nachname}
              onChange={(v) => handleChange("nachname", v)}
              required
            />
          </div>
        </div>

        {/* Kontaktdaten */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <TextField
              label="E-Mail"
              type="email"
              value={form.email}
              onChange={(v) => handleChange("email", v)}
              optional
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <TextField
              label="Telefon"
              value={form.telefonnummer}
              onChange={(v) => handleChange("telefonnummer", v)}
              optional
            />
          </div>
        </div>

        {/* Datumsfelder */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <TextField
              label="Geburtsdatum"
              type="date"
              value={form.geburtsdatum}
              onChange={(v) => handleChange("geburtsdatum", v)}
              optional
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <TextField
              label="Eintrittsdatum"
              type="date"
              value={form.eintrittsdatum}
              onChange={(v) => handleChange("eintrittsdatum", v)}
              optional
            />
          </div>
        </div>

        {/* Status */}
        <Select
          label="Status"
          value={form.status}
          onChange={(v) => handleChange("status", v as MitgliedFormData["status"])}
          options={STATUS_SELECT_OPTIONEN}
          required
        />

        <fieldset
          aria-required="true"
          aria-invalid={vereinFehler ? "true" : undefined}
          aria-describedby={vereinFehler ? vereinFehlerId : undefined}
          className="space-y-2"
        >
          <legend className="font-inter text-xs font-medium uppercase tracking-wider text-fcb-muted">
            Verein <span className="normal-case text-fcb-red">*</span>
            <span className="sr-only">
              Pflichtfeld, mindestens eine Auswahl
            </span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {VEREINS_OPTIONEN.map((verein) => {
              const info = TRAEGER_INFO[verein];
              const accent = getTeamAccent(verein);
              const ausgewaehlt = form.verein.includes(verein);
              const darfBearbeiten = darfVereinZuweisen(verein);

              return (
                <label
                  key={verein}
                  title={info.name}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 font-inter text-sm transition-colors ${
                    ausgewaehlt
                      ? `${accent.border} ${accent.bgSoft}`
                      : "border-fcb-border bg-fcb-bg"
                  } ${darfBearbeiten ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}
                >
                  <input
                    type="checkbox"
                    checked={ausgewaehlt}
                    disabled={!darfBearbeiten}
                    onChange={() => vereinUmschalten(verein)}
                    className="h-4 w-4 rounded border-fcb-border accent-fcb-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fcb-accent"
                  />
                  <span className={ausgewaehlt ? accent.text : "text-fcb-text"}>
                    {info.label}
                    <span className="sr-only"> – {info.name}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {eigeneRolle === "vorstand" &&
            form.verein.some((verein) => !darfVereinZuweisen(verein)) && (
              <p className="font-inter text-xs text-fcb-muted">
                Bereits zugeordnete fremde Vereine bleiben sichtbar, können von
                dir aber nicht geändert werden.
              </p>
            )}
          {vereinFehler && (
            <p
              id={vereinFehlerId}
              role="alert"
              className="font-inter text-xs text-fcb-red"
            >
              {vereinFehler}
            </p>
          )}
        </fieldset>

        {/* Mannschaft(en) – kommagetrennte Eingabe für bessere UX als Freitext */}
        <TextField
          label="Mannschaft(en) – kommagetrennt"
          value={form.mannschaftText}
          onChange={(v) => handleChange("mannschaftText", v)}
          placeholder="z. B. Herren 1, A-Jugend"
          optional
        />

        {/* Notizen */}
        <Textarea
          label="Notizen"
          value={form.notizen}
          onChange={(v) => handleChange("notizen", v)}
          placeholder="Interne Hinweise (optional)"
          rows={3}
          optional
        />

        {/* Aktionen */}
        <div className="flex justify-between pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Abbrechen
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={speichert}
          >
            {speichert ? "Wird gespeichert …" : "Speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
