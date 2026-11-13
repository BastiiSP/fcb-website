-- Serienbuchungen zusammenhalten: Alle Termine einer wöchentlichen Serie tragen
-- dieselbe serien_id (Client-generierte UUID). NULL = Einzelbuchung bzw.
-- Alt-Serie von vor diesem Feature. Ermöglicht "Ganze Serie bearbeiten/löschen".
alter table public.buchungen add column if not exists serien_id uuid;

-- Partieller Index: Serien-Operationen filtern immer auf serien_id;
-- Einzelbuchungen (NULL) müssen den Index nicht aufblähen.
create index if not exists buchungen_serien_id_idx
  on public.buchungen (serien_id)
  where serien_id is not null;

comment on column public.buchungen.serien_id is
  'Gemeinsame ID aller Termine einer wöchentlichen Serie; NULL bei Einzelbuchungen.';
