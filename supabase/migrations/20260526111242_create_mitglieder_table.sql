
-- Tabelle mitglieder für Phase 2 – Vereinsmitglieder ohne Login-Konto
CREATE TABLE mitglieder (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  mitgliedsnummer  INTEGER GENERATED ALWAYS AS IDENTITY,
  vorname          TEXT    NOT NULL,
  nachname         TEXT    NOT NULL,
  email            TEXT,
  telefonnummer    TEXT,
  geburtsdatum     DATE,
  eintrittsdatum   DATE,
  status           TEXT    DEFAULT 'aktiv'
                   CHECK (status IN ('aktiv','passiv','ehrenamt','gekündigt')),
  mannschaft       TEXT[],
  notizen          TEXT,
  -- erstellt_von wird beim INSERT mit der User-ID des anlegenden Vorstandsmitglieds befüllt
  erstellt_von     UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- updated_at-Trigger – nutzt dieselbe Funktion wie profiles und buchungen
CREATE TRIGGER set_mitglieder_updated_at
  BEFORE UPDATE ON mitglieder
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- RLS aktivieren – Zugangskontrolle läuft ausschließlich über die DB
ALTER TABLE mitglieder ENABLE ROW LEVEL SECURITY;

-- SELECT: nur vorstand und admin dürfen Mitglieder einsehen
CREATE POLICY "mitglieder_select"
  ON mitglieder FOR SELECT
  USING (get_own_rolle() IN ('vorstand','admin'));

-- INSERT: nur vorstand und admin dürfen Mitglieder anlegen
CREATE POLICY "mitglieder_insert"
  ON mitglieder FOR INSERT
  WITH CHECK (get_own_rolle() IN ('vorstand','admin'));

-- UPDATE: nur vorstand und admin dürfen Mitglieder bearbeiten
CREATE POLICY "mitglieder_update"
  ON mitglieder FOR UPDATE
  USING  (get_own_rolle() IN ('vorstand','admin'))
  WITH CHECK (get_own_rolle() IN ('vorstand','admin'));

-- DELETE: nur vorstand und admin dürfen Mitglieder löschen
CREATE POLICY "mitglieder_delete"
  ON mitglieder FOR DELETE
  USING (get_own_rolle() IN ('vorstand','admin'));
