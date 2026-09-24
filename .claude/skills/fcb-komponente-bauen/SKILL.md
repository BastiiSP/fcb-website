---
name: fcb-komponente-bauen
description: Beim Bauen oder Ändern einer React/Next-Komponente im FCB-Projekt – Design-Tokens, Fonts, Icons, Animationen, A11y. Triggert bei neue Komponente, UI bauen, Card/Modal/Button/Nav, Tailwind-Klassen, Framer Motion, Lucide-Icon, Social-Icon, Styling, Design-Spec.
---

# FCB-Komponente bauen

## Überblick

Verifiziertes Rezept für eine neue oder geänderte Frontend-Komponente in diesem Projekt.
**Kernprinzip:** Werte und Bibliotheks-Eigenheiten nicht raten – sie sind unten festgehalten
und gegen den echten Code geprüft (Stand 2026-07-07).

**WICHTIGSTE Eigenheit – Dual-Theme über semantische Tokens:**
Das Design-System ist vollständig umgesetzt. Alle `fcb.*`-Klassen (außer `blue`/`red`) lösen
über CSS-Variablen aus `globals.css` auf und tragen je Theme (`.dark`/`.light` auf `<html>`,
Default dunkel, Umschalter im Footer) andere Werte. **Jede Komponente muss in beiden Themes
funktionieren** – deshalb ausschließlich Tokens, nie feste Farben, und beim Testen einmal
umschalten. Auch Hero und Auth-Seiten folgen dem Theme (bewusste Entscheidung – keine
always-dark-Inseln wieder einführen). Es gibt keine `gray-*`-Altlasten mehr im Projekt.

## Verifizierte Bausteine (NICHT raten)

| Baustein | Korrekter Wert |
|---|---|
| Tailwind-Version | **3.4.1** – KEIN v4. Keine `@theme`-Directive, kein `tailwind.config` in CSS. Klassen wie gewohnt in `tailwind.config.ts`. |
| Marken-Akzent | **`fcb-accent`** für alles generische Marken-Chrome (Buttons, Links, aktive States, Fokus-Ringe) – wechselt per `data-tenant` zwischen FCB-Blau und JFG-Rot. `fcb-blue`/`fcb-red` NUR für feste Trägerzuordnung (Team gehört zu FCB/JFG, `getTeamAccent`) und `danger`/`error`. Primitive-Varianten heißen dafür `brand`. |
| Farb-Tokens | `bg-fcb-bg` `bg-fcb-surface` `border-fcb-border` `text-fcb-text` `text-fcb-muted` `fcb-accent` `fcb-blue` `fcb-red`. Semantisch: lösen per CSS-Variablen aus `globals.css` auf (Dual-Theme), Opacity-Modifier wie `bg-fcb-surface/80` funktionieren. **Keine magic hex, kein `gray-*`.** (`fcb-nav`/`fcb-footer` existieren als Reserve, sind aber ungenutzt – Header und Footer nutzen `fcb-surface`.) |
| UI-Primitive | **Erst `src/components/ui/` prüfen, bevor selbst gebaut wird:** `Button`, `ButtonLink` (+ `buttonStyles` für Server-Kontexte), `Card`, `Banner`, `Badge`, `IconBadge`, `TeamCard`, `Modal`, `PageShell`, `PageHeader`, `Tabs`, `Select`, `TextField`, `Textarea`, `ThemeToggle`, `ZugriffsHinweis`. **Varianten, Größen und Detailwerte: [design-spec.md](design-spec.md)** – vor dem Bauen lesen. |
| Theme-Zugriff | `hooks/useTheme.ts` (lesen/umschalten) + `lib/theme.ts` (`applyTheme`, `DEFAULT_THEME: dark`). Nie direkt `document.documentElement.classList` manipulieren. |
| Headline-Font | `font-oswald` (CSS-Var-gebunden, lädt zuverlässig). `font-display` existiert auch, ist aber NICHT an next/font gebunden → für neue Komponenten `font-oswald` nehmen. |
| Body-Font | `font-inter` |
| Animationen | **Framer Motion** (`framer-motion`, v12) – `motion.*`, `AnimatePresence`, `useScroll`, `useMotionValueEvent`. Keine CSS-`@keyframes` für neue Komponenten. |
| Generische Icons | `lucide-react` (v1.17) – `Menu`, `X`, `User`, `LogIn`, `LogOut`, `MapPin`, `Mail`, `Phone`, `UserPlus`, … |
| Brand-/Social-Icons | **`@/components/icons/BrandIcons.tsx`** (`FacebookIcon`, `InstagramIcon`). Lucide hat KEINE Brand-Glyphen mehr. `react-icons` ist nur Altlast – NICHT für neue Icons nutzen. |
| Client vs Server | Interaktiv (State, Motion, Events, Hooks) → `"use client"` als erste Zeile. Statisch → Server-Komponente lassen. |
| Supabase-Client | `import { supabase } from "@/lib/supabaseClient"` |
| Bilder | `next/image` (`Image`), `alt` ist Pflicht (deutsch). |

## Kanonisches Vorbild: `src/components/Header.tsx`

Diese Komponente zeigt das vollständige moderne Muster – beim Bauen daran orientieren:

- `"use client"` + benannte Imports aus `framer-motion`
- Smart-Sticky-Nav: `useScroll` + `useMotionValueEvent`, versteckt ab `scrollY > 80` & `delta > 5`
- `<motion.header animate={{ y: hidden ? "-100%" : 0 }} transition={{ duration: 0.25 }}>`
- `AnimatePresence` für Mobile-Menü (`initial`/`animate`/`exit`)
- Durchgängig fcb-Tokens: `border-fcb-border bg-fcb-surface/90 text-fcb-text hover:text-fcb-blue`
- `font-oswald` für den Vereinsnamen, `font-inter` für Nav-Links
- Lucide `Menu`/`X`, **deutsche `aria-label`** ("Menü öffnen"/"Menü schließen")
- Kommentare erklären das *Warum* (Hierarchie, Anti-Flacker-Schwelle)

## Design-Prinzipien (verbindlich)

- **Keine Emojis** in der UI – ausschließlich Lucide-Icons (Social: BrandIcons).
- **Framer Motion** für alle Animationen (Einblendungen, Hover, Übergänge).
- **A11y**: Fokus-States sichtbar lassen, Kontrast WCAG AA, jedes interaktive Element mit
  Label/`aria-label` (deutsch). Zum Prüfen: Skill `chrome-devtools-mcp:a11y-debugging`.
- **Deutsch**: alle sichtbaren Texte, `alt`, `aria-label`, Kommentare.
- **Akzent**: Marken-Chrome → `fcb-accent` (tenant-abhängig). Feste Zuordnung zu einem Verein/Team → FCB = `fcb-blue`, JFG = `fcb-red`.
- **Multi-Tenant**: Keine Markennamen, Logos oder Texte hart codieren – aus `lib/tenant.ts` (`getTenant()` / `TenantProvider`) lesen. Mit `?tenant=jfg` im Browser gegenprüfen.

## Workflow-Checkliste

1. **Plan-Modus** bei größeren Komponenten (CLAUDE.md). Micro-Fix (eine Klasse, ein Text) → direkt.
2. **Primitive zuerst**: Deckt `src/components/ui/` den Baustein ab (Button, Card, Banner, Modal, …)? Dann nutzen statt nachbauen. Als Muster-Vorbilder dienen `Header.tsx`, `UserDropdown.tsx`, `TeamCard.tsx`.
3. **Bauen** nach Tabelle oben: fcb-Tokens, Oswald/Inter, Lucide/BrandIcons, Framer Motion, `"use client"` nur wenn nötig.
4. **TypeScript strict**: explizites Props-`interface`, **kein `any`**, Union-Types für feste Wertemengen.
5. **Kommentieren**: das *Warum* bei nicht-offensichtlicher Logik/Animation/Entscheidung.
6. **Beide Themes prüfen**: Umschalter im Footer – Komponente muss hell UND dunkel funktionieren (Kontrast, Borders, Tints).
7. **Lint**: `npm run lint`. (`npm run build` kann lokal an Turbopack+FullCalendar scheitern – wenn der Fehler ausschließlich daher rührt, kein Blocker; Vercel-Build greift. Ersatz: `npx tsc --noEmit`.) Bei größeren UI-Änderungen zusätzlich `npm run test:e2e` (Playwright-Smoke).
8. **Commit & Push** auf `main` (`feat:`/`fix:`-Präfix), Vercel deployt automatisch.
9. **Claudian-Update** im vorgeschriebenen Format ausgeben (Sektion „Manuell zu testen" ist Pflicht).

## Häufige Fehler

| Fehler | Folge / Fix |
|---|---|
| `bg-fcb-blue` für Button/Link/Fokus in geteilter UI | Auf der JFG-Domain falsch blau. `fcb-accent` nutzen. |
| `gray-*` / magic hex in neuer Komponente | Bricht das Dual-Theme (Farbe passt nur in einem Theme). `fcb.*`-Tokens nutzen. |
| Nur im Dark-Theme (Default) getestet | Light-Theme-Bugs bleiben unsichtbar. Umschalter im Footer, beide prüfen. |
| Button/Card/Modal selbst nachgebaut | Drift vom Design-System. Primitive aus `src/components/ui/` verwenden. |
| `import { Facebook } from "lucide-react"` | `undefined` – Lucide hat keine Brand-Icons. `BrandIcons.tsx` nutzen (Facebook, Instagram, WhatsApp, Google). |
| Deutsche Anführungszeichen `„…"` direkt in JSX-String-Attribut | Bricht den TS-JSX-Parser. Stattdessen Template-Literal: `prop={`…„x"…`}`. Schlusszeichen ist `“` (U+201C), nicht ASCII `"`. |
| `font-display` erwartet, dass Oswald lädt | `font-display` ist NICHT an next/font gebunden. `font-oswald` nehmen. |
| Tailwind-v4-Syntax (`@theme`, CSS-`@config`) | Projekt ist v3.4. Tokens in `tailwind.config.ts`. |
| CSS-`@keyframes` für neue Animation | Projektstandard ist Framer Motion. |
| Nachbar-Code ungefragt umgebaut/„mitverbessert" | Aufräumarbeiten sind beauftragungspflichtig. Nur ändern, was Basti benannt hat. |
| `react-icons` für ein neues Icon | Altlast-Dependency. Lucide bzw. BrandIcons nutzen. |
