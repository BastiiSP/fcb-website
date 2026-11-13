
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.buchungen
  TO authenticated;

GRANT SELECT ON public.profiles TO anon;
