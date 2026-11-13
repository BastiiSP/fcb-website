// Nur nach erfolgreicher externer Netz- und Containerprüfung im Testziel
// ausführen. Die lokale Kennung schützt zusätzlich vor falscher Zielauswahl.
export const lokalisiereRestore = String.raw`
BEGIN;
DO $guard$
BEGIN
  IF current_database() <> 'isolated_restore'
     OR current_setting('restore_app.isolation_verified', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Isoliertes Restore-Ziel nicht bestätigt';
  END IF;
END
$guard$;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
DO $avatar_guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE avatar_url IS NOT NULL
      AND strpos(avatar_url, 'https://jktvmckqfklfziszfsxf.supabase.co/storage/v1/object/public/avatars/') <> 1
  ) THEN
    RAISE EXCEPTION 'Nicht unterstützte Avatar-Herkunft';
  END IF;
END
$avatar_guard$;
ALTER TABLE public.profiles DROP CONSTRAINT profiles_avatar_url_storage_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_url_storage_check
  CHECK (avatar_url IS NULL OR strpos(avatar_url, 'https://127.0.0.1:8000/storage/v1/object/public/avatars/') = 1) NOT VALID;
UPDATE public.profiles SET avatar_url =
  'https://127.0.0.1:8000/storage/v1/object/public/avatars/' ||
  substr(avatar_url, length('https://jktvmckqfklfziszfsxf.supabase.co/storage/v1/object/public/avatars/') + 1)
WHERE avatar_url IS NOT NULL;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_avatar_url_storage_check;
TRUNCATE auth.sessions CASCADE;
COMMIT;
`;
