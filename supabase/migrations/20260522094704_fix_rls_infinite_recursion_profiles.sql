
-- Schritt 1: Rekursive Policies droppen
DROP POLICY IF EXISTS "Vorstand und Admin lesen alle Profile" ON public.profiles;
DROP POLICY IF EXISTS "Vorstand und Admin vergeben Rollen" ON public.profiles;

-- Schritt 2: Hilfsfunktion anlegen (bricht die Rekursion)
CREATE OR REPLACE FUNCTION public.get_own_rolle()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT rolle FROM public.profiles WHERE id = auth.uid();
$$;

-- Schritt 3: Policies neu anlegen (nutzen jetzt die Funktion)
CREATE POLICY "Vorstand und Admin lesen alle Profile"
  ON public.profiles FOR SELECT
  USING (public.get_own_rolle() IN ('vorstand', 'admin'));

CREATE POLICY "Vorstand und Admin vergeben Rollen"
  ON public.profiles FOR UPDATE
  USING (public.get_own_rolle() IN ('vorstand', 'admin'));
