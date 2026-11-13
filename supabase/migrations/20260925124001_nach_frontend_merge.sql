-- Migration: Abschluss der Sicherheitshärtung – ERST NACH dem Merge des
-- Frontends (Branch fix/security-audit-2026-09) auf main anwenden.
--
-- 1. Audit L2: Trainer lesen andere Profile nur noch über die RPC
--    public.trainer_verzeichnis() mit festen Spalten. Die alte Policy gab
--    alle Spalten (inkl. geburtsdatum, avatar_url) frei. Das neue
--    TrainerVerzeichnis.tsx nutzt bereits die RPC – vor dem Merge würde das
--    alte Verzeichnis leer angezeigt.
drop policy if exists profiles_select_trainer_verzeichnis on public.profiles;

-- 2. Übergangs-Default aus 20260924120150 entfernen: Das neue Formular sendet
--    die Vereinszuordnung immer explizit mit; ein stiller Default könnte
--    Mitglieder sonst unbemerkt dem falschen Verein zuschlagen.
alter table public.mitglieder alter column verein drop default;
