
-- =============================================
-- Tabelle: profiles
-- =============================================
CREATE TABLE public.profiles (
  id            UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  vorname       TEXT NOT NULL,
  nachname      TEXT NOT NULL,
  telefonnummer TEXT,
  rolle         TEXT NOT NULL DEFAULT 'ausstehend'
                  CHECK (rolle IN ('ausstehend', 'trainer', 'vorstand', 'admin')),
  mannschaft    TEXT[],
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- updated_at Funktion
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS Policies für profiles
CREATE POLICY "Eigenes Profil lesen"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Eigenes Profil updaten"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Vorstand und Admin lesen alle Profile"
  ON public.profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND rolle IN ('vorstand', 'admin'))
  );

CREATE POLICY "Vorstand und Admin vergeben Rollen"
  ON public.profiles FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND rolle IN ('vorstand', 'admin'))
  );

-- =============================================
-- Trigger: Profil bei Registrierung anlegen
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, vorname, nachname, telefonnummer, mannschaft, rolle)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'vorname', ''),
    COALESCE(NEW.raw_user_meta_data->>'nachname', ''),
    NEW.raw_user_meta_data->>'telefonnummer',
    CASE
      WHEN NEW.raw_user_meta_data->'mannschaften' IS NOT NULL
      THEN ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'mannschaften'))
      ELSE NULL
    END,
    'ausstehend'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- Tabelle: buchungen
-- =============================================
CREATE TABLE public.buchungen (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platz            TEXT NOT NULL CHECK (platz IN ('hauptplatz', 'nebenplatz')),
  platzanteil      TEXT NOT NULL CHECK (platzanteil IN ('viertel', 'halb', 'ganz')),
  anlass           TEXT NOT NULL CHECK (anlass IN ('training', 'freundschaftsspiel', 'punktspiel', 'platzpflege')),
  startzeit        TIMESTAMPTZ NOT NULL,
  endzeit          TIMESTAMPTZ NOT NULL,
  mannschaft       TEXT NOT NULL,
  buchende_person  TEXT NOT NULL,
  bemerkung        TEXT,
  user_id          UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.buchungen ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_buchungen_updated_at
  BEFORE UPDATE ON public.buchungen
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS Policies für buchungen
CREATE POLICY "Buchungen lesen (eingeloggt)"
  ON public.buchungen FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Buchung anlegen (trainer+)"
  ON public.buchungen FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND rolle IN ('trainer', 'vorstand', 'admin'))
  );

CREATE POLICY "Buchung bearbeiten"
  ON public.buchungen FOR UPDATE USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND rolle IN ('vorstand', 'admin'))
  );

CREATE POLICY "Buchung loeschen"
  ON public.buchungen FOR DELETE USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND rolle IN ('vorstand', 'admin'))
  );
