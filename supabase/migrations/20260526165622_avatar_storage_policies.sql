
-- Storage-Policy: Authentifizierter User darf eigenes Bild lesen/schreiben (Pfad: <user_id>/...)
DROP POLICY IF EXISTS "avatars_owner_rw" ON storage.objects;
CREATE POLICY "avatars_owner_rw" ON storage.objects
  FOR ALL TO authenticated
  USING  (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Public read für Anzeige (ohne Auth)
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
