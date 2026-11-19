"use client";

import Image from "next/image";
import { useId, useRef, useState, type PointerEvent } from "react";
import Banner from "@/components/ui/Banner";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import TextField from "@/components/ui/TextField";

interface UnterschriftsfeldProps {
  onChange: (bild: string | null) => void;
  bild?: string | null;
  bezeichnung?: string;
  signaturname?: string;
}

interface Punkt {
  x: number;
  y: number;
}

interface AktiverStrich {
  zeiger: number;
  punkte: Punkt[];
  laenge: number;
}

const BREITE = 600;
const HOEHE = 240;
const STRICHBREITE = 4;

function zeichnen(kontext: CanvasRenderingContext2D, striche: Punkt[][]) {
  kontext.lineCap = "round";
  kontext.lineJoin = "round";
  kontext.lineWidth = STRICHBREITE;
  for (const [anfang, ...verlauf] of striche) {
    kontext.beginPath();
    kontext.moveTo(anfang.x, anfang.y);
    for (const punkt of verlauf) kontext.lineTo(punkt.x, punkt.y);
    kontext.stroke();
  }
}

function vergleichbarerName(name: string) {
  return name.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
}

function pfad(punkte: Punkt[]) {
  return punkte.map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join(" ");
}

function position({ clientX, clientY, currentTarget }: PointerEvent<SVGSVGElement>): Punkt {
  const rahmen = currentTarget.getBoundingClientRect();
  const rand = STRICHBREITE;
  return {
    x: Math.min(BREITE - rand, Math.max(rand, ((clientX - rahmen.left) / rahmen.width) * BREITE)),
    y: Math.min(HOEHE - rand, Math.max(rand, ((clientY - rahmen.top) / rahmen.height) * HOEHE)),
  };
}

export default function Unterschriftsfeld({
  onChange,
  bild,
  bezeichnung,
  signaturname,
}: UnterschriftsfeldProps) {
  const hilfeId = useId();
  const [offen, setOffen] = useState(false);
  const [lokalesBild, setLokalesBild] = useState<string | null>(null);
  const [methode, setMethode] = useState<"zeichnen" | "name">("zeichnen");
  const [name, setName] = useState("");
  const [striche, setStriche] = useState<Punkt[][]>([]);
  const [vorschau, setVorschau] = useState<Punkt[]>([]);
  const [fehler, setFehler] = useState("");
  const aktiv = useRef<AktiverStrich | null>(null);
  const gespeichert = bild === undefined ? lokalesBild : bild;
  const istZeichnung = methode === "zeichnen";
  const kannUebernehmen = istZeichnung ? striche.length > 0 : /\p{L}/u.test(name);
  const aktionszusatz = bezeichnung ? ` – ${bezeichnung}` : "";

  function entwurfLeeren() {
    aktiv.current = null;
    setStriche([]);
    setVorschau([]);
    setName("");
    setFehler("");
  }

  function schliessen() {
    entwurfLeeren();
    setOffen(false);
  }

  function anfangen(event: PointerEvent<SVGSVGElement>) {
    if (aktiv.current || event.button !== 0) return;
    const punkte = [position(event)];
    event.currentTarget.setPointerCapture(event.pointerId);
    aktiv.current = { zeiger: event.pointerId, punkte, laenge: 0 };
    setVorschau(punkte);
  }

  function punktAufnehmen(event: PointerEvent<SVGSVGElement>) {
    const aktuellerStrich = aktiv.current;
    if (!aktuellerStrich || aktuellerStrich.zeiger !== event.pointerId) return;
    const punkt = position(event);
    const letzterPunkt = aktuellerStrich.punkte[aktuellerStrich.punkte.length - 1];
    aktuellerStrich.laenge += Math.hypot(punkt.x - letzterPunkt.x, punkt.y - letzterPunkt.y);
    aktuellerStrich.punkte.push(punkt);
    return aktuellerStrich;
  }

  function fortsetzen(event: PointerEvent<SVGSVGElement>) {
    const aktuellerStrich = punktAufnehmen(event);
    if (aktuellerStrich) setVorschau([...aktuellerStrich.punkte]);
  }

  function beenden(event: PointerEvent<SVGSVGElement>) {
    const aktuellerStrich = punktAufnehmen(event);
    if (!aktuellerStrich) return;
    // Ein Tippen ohne erkennbare Bewegung liefert keinen Unterschriftsstrich.
    if (aktuellerStrich.laenge >= 6) setStriche((bisher) => [...bisher, aktuellerStrich.punkte]);
    verwerfen(event);
  }

  function verwerfen(event: PointerEvent<SVGSVGElement>) {
    if (aktiv.current?.zeiger !== event.pointerId) return;
    aktiv.current = null;
    setVorschau([]);
  }

  function abbildUebernehmen() {
    if (!kannUebernehmen || aktiv.current) return;
    if (!istZeichnung && signaturname !== undefined && vergleichbarerName(name) !== vergleichbarerName(signaturname)) {
      setFehler("Gib den vollständigen Namen so ein, wie er im Formular steht.");
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = BREITE * 2;
      canvas.height = HOEHE * 2;
      const kontext = canvas.getContext("2d");
      if (!kontext) throw new Error("Zeichenfläche nicht verfügbar");
      kontext.scale(2, 2);
      // Das Abbild ist für den Druck auf weißem Papier bestimmt.
      kontext.strokeStyle = kontext.fillStyle = "black";
      if (istZeichnung) {
        zeichnen(kontext, striche);
      } else {
        kontext.font = "24px sans-serif";
        kontext.fillText("Unterschrift per Namenseingabe", 16, 47);
        kontext.font = "36px sans-serif";
        kontext.fillText(name.trim(), 16, 99, BREITE - 32);
      }
      const abbild = canvas.toDataURL("image/png");
      setLokalesBild(abbild);
      onChange(abbild);
      schliessen();
    } catch {
      setFehler("Die Unterschrift konnte nicht übernommen werden. Bitte versuche es erneut.");
    }
  }

  return (
    <div className="space-y-2">
      {gespeichert && (
        <div className="max-w-xs rounded-lg border border-fcb-border bg-fcb-bg">
          <Image
            src={gespeichert}
            alt={`Übernommene Unterschrift${aktionszusatz}`}
            width={BREITE}
            height={HOEHE}
            unoptimized
            className="h-auto w-full dark:invert"
          />
        </div>
      )}
      <p role="status" className="text-sm text-fcb-muted">
        {gespeichert ? "Unterschrift übernommen." : "Unterschrift fehlt."}
      </p>
      <Button
        variant="secondary"
        className="min-h-11"
        onClick={() => {
          setMethode("zeichnen");
          setOffen(true);
        }}
        aria-label={`${gespeichert ? "Unterschrift bearbeiten" : "Unterschreiben"}${aktionszusatz}`}
      >
        {gespeichert ? "Unterschrift bearbeiten" : "Unterschreiben"}
      </Button>

      <Modal open={offen} onClose={schliessen} title={`Unterschrift${aktionszusatz}`}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Art der Unterschrift">
            <Button
              variant="secondary"
              size="sm"
              className="min-h-11 aria-pressed:border-fcb-accent"
              onClick={() => {
                setFehler("");
                setMethode("zeichnen");
              }}
              aria-pressed={istZeichnung}
            >
              Zeichnen
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="min-h-11 aria-pressed:border-fcb-accent"
              onClick={() => {
                setFehler("");
                setMethode("name");
              }}
              aria-pressed={!istZeichnung}
            >
              Namen eingeben
            </Button>
          </div>

          {istZeichnung ? (
            <div className="space-y-2">
              <p id={hilfeId} className="text-sm text-fcb-muted">
                Zeichne mit Finger, Stift oder Maus in der Fläche.
              </p>
              <div className="rounded-lg border border-fcb-border bg-fcb-bg">
                {/* Eine feste Zeichenfläche erhält die Striche beim Drehen des Geräts. */}
                <svg
                  viewBox={`0 0 ${BREITE} ${HOEHE}`}
                  role="img"
                  aria-label="Zeichenfläche für die Unterschrift"
                  aria-describedby={hilfeId}
                  className="block aspect-[5/2] w-full touch-none select-none text-fcb-text"
                  onPointerDown={anfangen}
                  onPointerMove={fortsetzen}
                  onPointerUp={beenden}
                  onPointerCancel={verwerfen}
                  onLostPointerCapture={verwerfen}
                >
                  <g fill="none" stroke="currentColor" strokeWidth={STRICHBREITE} strokeLinecap="round" strokeLinejoin="round">
                    {striche.map((punkte, index) => <path key={index} d={pfad(punkte)} />)}
                    <path d={pfad(vorschau)} />
                  </g>
                </svg>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11"
                disabled={striche.length === 0}
                onClick={entwurfLeeren}
              >
                Zeichnung löschen
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-fcb-muted">
                Wenn du die Zeichenfläche nicht benutzen kannst, gib deinen vollständigen Namen ein.
                Das PDF kennzeichnet diese Unterschrift als Namenseingabe.
              </p>
              <TextField
                label="Vollständiger Name"
                value={name}
                onChange={(eingabe) => {
                  setFehler("");
                  setName(eingabe);
                }}
                autoComplete="off"
                maxLength={signaturname?.normalize("NFD").length || 161}
              />
            </div>
          )}

          {fehler && <div role="alert"><Banner variant="error" message={fehler} /></div>}
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" onClick={abbildUebernehmen} disabled={!kannUebernehmen}>
              Unterschrift übernehmen
            </Button>
            <Button variant="ghost" className="min-h-11" onClick={schliessen}>Abbrechen</Button>
            {gespeichert && (
              <Button
                variant="ghost"
                className="min-h-11"
                onClick={() => {
                  setLokalesBild(null);
                  onChange(null);
                  schliessen();
                }}
              >
                Übernommene Unterschrift löschen
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
