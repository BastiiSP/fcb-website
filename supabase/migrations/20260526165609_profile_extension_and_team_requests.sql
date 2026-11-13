
-- 1.1 profiles erweitern
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS geburtsdatum    DATE,
  ADD COLUMN IF NOT EXISTS strasse         TEXT,
  ADD COLUMN IF NOT EXISTS plz             TEXT,
  ADD COLUMN IF NOT EXISTS ort             TEXT,
  ADD COLUMN IF NOT EXISTS trainer_lizenzen TEXT[],
  ADD COLUMN IF NOT EXISTS avatar_url      TEXT;

-- 1.2 Rolle 'mitglied' zulassen
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_rolle_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_rolle_check
  CHECK (rolle IN ('ausstehend','trainer','vorstand','admin','mitglied'));

-- 1.3 Trigger: eigene Rolle und Mannschaft darf der User nicht selbst ändern
CREATE OR REPLACE FUNCTION public.prevent_self_role_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Nur bei Änderungen, die der User an seiner eigenen Zeile vornimmt
  IF auth.uid() = NEW.id AND NEW.rolle IS DISTINCT FROM OLD.rolle THEN
    RAISE EXCEPTION 'Die eigene Rolle darf nicht geändert werden';
  END IF;
  IF auth.uid() = NEW.id AND NEW.mannschaft IS DISTINCT FROM OLD.mannschaft THEN
    RAISE EXCEPTION 'Die Mannschaft darf nicht direkt geändert werden – bitte Anfrage stellen';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_role_change ON public.profiles;
CREATE TRIGGER trg_prevent_self_role_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_change();

-- 1.4 Tabelle mannschaftsanfragen
CREATE TABLE IF NOT EXISTS public.mannschaftsanfragen (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  typ             TEXT NOT NULL CHECK (typ IN ('hinzufuegen','entfernen')),
  mannschaft      TEXT NOT NULL,
  begruendung     TEXT,
  status          TEXT NOT NULL DEFAULT 'offen'
                    CHECK (status IN ('offen','genehmigt','abgelehnt')),
  bearbeitet_von  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  bearbeitet_am   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- updated_at-Trigger für mannschaftsanfragen (nutzt handle_updated_at wie die anderen Tabellen)
DROP TRIGGER IF EXISTS trg_mannschaftsanfragen_updated_at ON public.mannschaftsanfragen;
CREATE TRIGGER trg_mannschaftsanfragen_updated_at
BEFORE UPDATE ON public.mannschaftsanfragen
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.mannschaftsanfragen ENABLE ROW LEVEL SECURITY;

-- RLS-Policies für mannschaftsanfragen
DROP POLICY IF EXISTS anfragen_select_own ON public.mannschaftsanfragen;
CREATE POLICY anfragen_select_own ON public.mannschaftsanfragen
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS anfragen_select_vorstand ON public.mannschaftsanfragen;
CREATE POLICY anfragen_select_vorstand ON public.mannschaftsanfragen
  FOR SELECT USING (public.get_own_rolle() IN ('vorstand','admin'));

DROP POLICY IF EXISTS anfragen_insert_own ON public.mannschaftsanfragen;
CREATE POLICY anfragen_insert_own ON public.mannschaftsanfragen
  FOR INSERT WITH CHECK (user_id = auth.uid() AND status = 'offen');

DROP POLICY IF EXISTS anfragen_update_vorstand ON public.mannschaftsanfragen;
CREATE POLICY anfragen_update_vorstand ON public.mannschaftsanfragen
  FOR UPDATE USING (public.get_own_rolle() IN ('vorstand','admin'))
  WITH CHECK (public.get_own_rolle() IN ('vorstand','admin'));

-- GRANT nicht vergessen (laut CLAUDE.md schon zweimal vergessen)
GRANT SELECT, INSERT, UPDATE ON public.mannschaftsanfragen TO authenticated;

-- 1.5 RPC: approve_mannschaftsanfrage – atomares Genehmigen
CREATE OR REPLACE FUNCTION public.approve_mannschaftsanfrage(anfrage_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_anfrage public.mannschaftsanfragen%ROWTYPE;
BEGIN
  -- Nur vorstand/admin darf genehmigen
  IF public.get_own_rolle() NOT IN ('vorstand', 'admin') THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;

  SELECT * INTO v_anfrage FROM public.mannschaftsanfragen WHERE id = anfrage_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anfrage nicht gefunden';
  END IF;

  IF v_anfrage.status != 'offen' THEN
    RAISE EXCEPTION 'Anfrage ist nicht mehr offen';
  END IF;

  -- Mannschaft im Profil atomar anpassen
  IF v_anfrage.typ = 'hinzufuegen' THEN
    UPDATE public.profiles
    SET mannschaft = array_append(COALESCE(mannschaft, '{}'), v_anfrage.mannschaft)
    WHERE id = v_anfrage.user_id
      AND NOT (v_anfrage.mannschaft = ANY(COALESCE(mannschaft, '{}')));
  ELSIF v_anfrage.typ = 'entfernen' THEN
    UPDATE public.profiles
    SET mannschaft = array_remove(COALESCE(mannschaft, '{}'), v_anfrage.mannschaft)
    WHERE id = v_anfrage.user_id;
  END IF;

  -- Anfrage als genehmigt markieren
  UPDATE public.mannschaftsanfragen
  SET status = 'genehmigt',
      bearbeitet_von = auth.uid(),
      bearbeitet_am  = now()
  WHERE id = anfrage_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_mannschaftsanfrage(UUID) TO authenticated;
