-- Erweitert handle_new_user um Google-OAuth-Namens-Fallbacks (abwärtskompatibel):
-- E-Mail/Passwort-Keys (vorname/nachname) behalten Vorrang; Google liefert
-- given_name/family_name bzw. full_name/name -> nur Fallback. Rolle bleibt
-- 'ausstehend' (Rollenkonzept unverändert). SECURITY DEFINER + leerer
-- search_path bleiben erhalten (Security-Härtung 2026-06-15 nicht regressen).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, vorname, nachname, telefonnummer, mannschaft, rolle)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'vorname', ''),
             NEW.raw_user_meta_data->>'given_name',
             split_part(COALESCE(NEW.raw_user_meta_data->>'full_name',
                                 NEW.raw_user_meta_data->>'name', ''), ' ', 1),
             ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'nachname', ''),
             NEW.raw_user_meta_data->>'family_name',
             NULLIF(substring(COALESCE(NEW.raw_user_meta_data->>'full_name',
                                       NEW.raw_user_meta_data->>'name', '')
                              from '\s(.*)$'), ''),
             ''),
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
$function$;
