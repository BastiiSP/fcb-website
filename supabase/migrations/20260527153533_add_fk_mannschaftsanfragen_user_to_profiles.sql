-- PostgREST kann profiles(...) nur einbetten, wenn eine direkte FK existiert.
-- mannschaftsanfragen.user_id zeigte bisher nur auf auth.users; profiles.id ist 1:1 dazu.
-- Zusätzliche FK auf profiles.id macht die Beziehung für PostgREST auflösbar.
ALTER TABLE public.mannschaftsanfragen
  ADD CONSTRAINT mannschaftsanfragen_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
