# FCB/JFG Design-Spec – Detailwerte

Abgestimmt mit Claudian (Basti), verbindlich. Stand 2026-07-07, Akzent-Werte gegen den Code
geprüft am 2026-09-24 (Multi-Tenant-Akzent `fcb-accent`). Vollständige Designdoku:
Obsidian `02 Projekte/FCB Website.md`. Die Grundprinzipien stehen in CLAUDE.md – hier nur
die Detailwerte der Primitive.

## Farb-Tokens (Dual-Theme + Multi-Tenant)

`fcb.*`-Klassen lösen über CSS-Variablen aus `globals.css` auf (`.dark`/`.light` auf
`<html>`, Default dunkel). Opacity-Modifier funktionieren (`bg-fcb-surface/80`).

| Token | Klasse | Dark | Light | Verwendung |
|---|---|---|---|---|
| Hintergrund | `bg-fcb-bg` | `#0a0a0a` | `#ffffff` | Seiten-BG, Hero, Sections |
| Surface | `bg-fcb-surface` | `#161616` | `#f5f5f5` | Cards, Panels, Modals, Header, Footer |
| Border | `border-fcb-border` | `#2a2a2a` | `#d4d4d4` | Trennlinien, Rahmen |
| Text | `text-fcb-text` | `#ffffff` | `#111111` | Primärtext |
| Muted | `text-fcb-muted` | `#888888` | `#5a5a5a` | Datum, Metainfo |
| Footer / Navbar | `bg-fcb-footer` / `bg-fcb-nav` | – | – | Reserve, ungenutzt |
| **Marken-Akzent** | `fcb-accent` | FCB `#1d5fad` / JFG `#cc1f1f` | (theme-konstant) | **Alles generische Marken-Chrome**: Buttons, Links, aktive States, Fokus-Ringe. Wechselt per `data-tenant` auf `<html>`. |
| FCB-Blau | `fcb-blue` | `#1d5fad` | (konstant) | Nur feste Trägerzuordnung (Mannschaft = FCB), Vereins-Switcher |
| JFG-Rot | `fcb-red` | `#cc1f1f` | (konstant) | Nur feste Trägerzuordnung (Mannschaft = JFG), `danger`, `error` |

**Faustregel:** Gehört die Farbe zur *aufgerufenen Marke* → `fcb-accent`. Gehört sie zu einem
*bestimmten Verein/Team* (unabhängig von der Domain) → `fcb-blue`/`fcb-red`, bei Teams über
`getTeamAccent(traeger)`.

## Typografie

- Headlines: `font-oswald`, Gewicht 600–700, gerne uppercase (`font-display` NICHT nutzen).
- Fließtext/UI: `font-inter`, 400/500 (Body-Default).

## Cards & Flächen – `ui/Card.tsx`

| Eigenschaft | Wert | Verwendung |
|---|---|---|
| Radius groß | `rounded-2xl` | Cards, Panels, Modals |
| Radius klein | `rounded-lg` | Banner, Buttons, Inputs, kleine Flächen |
| Border | `border border-fcb-border` | jede Card – Abhebung per Border, nicht Schatten |
| Fläche / Padding | `bg-fcb-surface` / `p-6` (kompakt `p-4`) | Standard |
| Akzentkante | Prop `accent`: `brand` (fcb-accent) / `blue` / `red` → `border-l-4` | `brand` für Marken-Bereiche, `blue`/`red` für feste Trägerzuordnung |
| Hover | Prop `interactive` → Border färbt sich zum Akzent (200 ms) | nur klickbare Cards |

- Card = Inhalts-Container; Banner = Statusmeldung – nie als Layout-Container missbrauchen.
- Tints immer `bg-<akzent>/10` + `border-<akzent>/40`, nie voll gesättigte Flächen.
- Kein Scale/Lift beim Hover – die Border-Farbe ist die Affordanz.

## Buttons – `ui/Button.tsx` (Klassen in `ui/buttonStyles.ts`)

Basis: `rounded-lg font-oswald font-semibold uppercase tracking-wide gap-2`, Fokus-Ring
`focus-visible:ring-2 ring-fcb-accent`.

| Variante | Optik | Wann |
|---|---|---|
| `primary` | `bg-fcb-accent text-white`, Hover `/90` | Hauptaktion – max. eine pro View/Formular |
| `secondary` | `border-fcb-border bg-fcb-surface`, Hover-Border `fcb-accent` | neutrale Nebenaktionen |
| `ghost` | nur Text, Hover `text-fcb-accent` | tertiär/Inline, Abbrechen |
| `danger` | `bg-fcb-red text-white`, Hover `/90` | destruktiv – immer mit Bestätigungs-Modal |

| Größe | Padding/Text | Wann |
|---|---|---|
| `sm` | `px-3 py-1.5 text-xs` | Tabellen-/Listen-Aktionen |
| `md` | `px-4 py-2.5 text-sm` | Standard |
| `lg` | `px-5 py-3 text-base` | Hero-/Seiten-CTAs |

- Icon im Button: Lucide `size={16}` (sm/md) bzw. `20` (lg), immer `aria-hidden`.
- Icon-only-Buttons: deutsches `aria-label` Pflicht.

## Icons

| Größe | Einsatz |
|---|---|
| `16` | inline, Buttons sm/md, Meta-Zeilen, Banner |
| `20` | Navigation, Buttons lg, Listen-Icons |
| `24` | Feature-Icons, Empty-States, IconBadge lg |

- `strokeWidth` 2; nur dekorative Icons ≥ 28 px dürfen 1.5.
- **IconBadge** (`ui/IconBadge.tsx`): Akzent `neutral` / `brand` / `blue` / `red`; Größen
  `sm` (32 px / 16er-Icon, `rounded-lg`), `md` (40/20, `rounded-xl`), `lg` (48/24, `rounded-xl`).
  `label`-Prop → `role="img"`, sonst dekorativ.
- Dekorative Icons `aria-hidden`, bedeutungstragende mit deutschem `aria-label`.

## Banner – `ui/Banner.tsx`

| Variante | Farbe | Icon | Einsatz |
|---|---|---|---|
| `warning` | Gelb (`border-yellow-500/40 bg-yellow-500/10`, Icon `text-yellow-600 dark:text-yellow-500`) | `TriangleAlert` | **Standard für „wartet auf Freigabe/Prüfung"** – immer dieses Gelb |
| `info` | `fcb-accent` (`/40` Border, `/10` Fläche) | `Info` | neutrale Hinweise, z. B. „Rolle nicht vorgesehen" |
| `success` | Grün | `CheckCircle2` | erfolgreiche Aktionen |
| `error` | `fcb-red` | `AlertCircle` | Fehler, blockierende Probleme |

## Mannschaftsdarstellung – `ui/TeamCard.tsx`

- Träger bestimmt den Akzent: FCB-Teams (Herren, E-/F-/G-Jugend) → blau, JFG-Teams
  (A-/B-/C-/D-Junioren) → rot. Klassen immer über `getTeamAccent(traeger)` aus `lib/teams.ts`.
- `interface Team` in `lib/teams.ts`: `id`, `name`, `kurzname?`, `altersklasse?`, `liga?`,
  `traeger: "fcb" | "jfg"`, `beschreibung?`, `trainer?: string[]`.
- Aufbau: (1) Kopfzeile – `IconBadge` (Users, Trägerakzent) links, Träger-Badge (`FCB`/`JFG`,
  Tint-Pill, voller Vereinsname für Screenreader via `TRAEGER_INFO`) rechts; (2) Teamname
  `font-oswald` uppercase + Altersklasse/Liga `text-fcb-muted`; (3) optionale Beschreibung;
  (4) Trainer-Slot unter `border-t border-fcb-border` (`team.trainer` oder `trainerSlot`-Prop).
- Grid: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`, mobil volle Breite.
- Einblendung: `whileInView`, y 16→0, einmalig, 0,4 s, respektiert `prefers-reduced-motion`.
