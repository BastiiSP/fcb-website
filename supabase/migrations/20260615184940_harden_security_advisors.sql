-- 1. approve_mannschaftsanfrage: NULL-sicherer Rollen-Check + search_path-Härtung.
CREATE OR REPLACE FUNCTION public.approve_mannschaftsanfrage(anfrage_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_anfrage public.mannschaftsanfragen%ROWTYPE;
BEGIN
  -- Nur vorstand/admin darf genehmigen (NULL-sicher: anon/Profil-lose werden geblockt)
  IF coalesce(public.get_own_rolle(), '') NOT IN ('vorstand', 'admin') THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;

  SELECT * INTO v_anfrage FROM public.mannschaftsanfragen WHERE id = anfrage_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anfrage nicht gefunden';
  END IF;

  IF v_anfrage.status != 'offen' THEN
    RAISE EXCEPTION 'Anfrage ist nicht mehr offen';
  END IF;

  PERFORM set_config('app.bypass_self_change', 'on', true);

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

  PERFORM set_config('app.bypass_self_change', 'off', true);

  UPDATE public.mannschaftsanfragen
  SET status = 'genehmigt',
      bearbeitet_von = auth.uid(),
      bearbeitet_am  = now()
  WHERE id = anfrage_id;
END;
$function$;

-- 2. search_path-Härtung der übrigen Funktionen.
ALTER FUNCTION public.handle_new_user()          SET search_path = '';
ALTER FUNCTION public.handle_updated_at()         SET search_path = '';
ALTER FUNCTION public.get_own_rolle()             SET search_path = '';
ALTER FUNCTION public.prevent_self_role_change()  SET search_path = '';

-- 3. Trigger-Funktionen aus der API nehmen.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at()        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_self_role_change() FROM PUBLIC;

-- 4. RPCs nur für authenticated freigeben (anon ausschließen).
REVOKE EXECUTE ON FUNCTION public.approve_mannschaftsanfrage(uuid)     FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.approve_mannschaftsanfrage(uuid)     TO authenticated;
REVOKE EXECUTE ON FUNCTION public.close_mannschaftsanfrage_banner(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.close_mannschaftsanfrage_banner(uuid) TO authenticated;

-- 5. Breite Listing-Policy des öffentlichen avatars-Buckets entfernen.
DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
