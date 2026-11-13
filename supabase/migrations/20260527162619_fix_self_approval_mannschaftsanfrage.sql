-- Bug-Fix: Antragsteller == genehmigende Person.
-- SECURITY DEFINER ändert nur die Rechte, NICHT auth.uid(). Wenn ein Admin/Vorstand
-- seine eigene Anfrage genehmigt, sieht der Trigger weiterhin auth.uid() = NEW.id und
-- blockte bisher das legitime mannschaft-Update.
-- Lösung: ein transaktions-lokales GUC-Flag, das ausschließlich die offizielle RPC
-- setzen kann. Clients können es nicht setzen (set_config liegt in pg_catalog und ist
-- nicht über PostgREST aufrufbar), daher bleibt der Schutz gegen direkte Manipulation
-- vollständig erhalten.

CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Die offizielle RPC approve_mannschaftsanfrage setzt dieses transaktions-lokale
  -- Flag, um die legitime Mannschaftsänderung durchzulassen. Clients können es nicht
  -- setzen → Schutz gegen direkte Manipulation bleibt bestehen.
  IF current_setting('app.bypass_self_change', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Nur bei Änderungen, die der User an seiner eigenen Zeile vornimmt
  IF auth.uid() = NEW.id AND NEW.rolle IS DISTINCT FROM OLD.rolle THEN
    RAISE EXCEPTION 'Die eigene Rolle darf nicht geändert werden';
  END IF;
  IF auth.uid() = NEW.id AND NEW.mannschaft IS DISTINCT FROM OLD.mannschaft THEN
    RAISE EXCEPTION 'Die Mannschaft darf nicht direkt geändert werden – bitte Anfrage stellen';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_mannschaftsanfrage(anfrage_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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

  -- Trigger prevent_self_role_change für dieses legitime Update überbrücken.
  -- true = nur in dieser Transaktion gültig (Auto-Reset am Transaktionsende;
  -- PostgREST = eine Transaktion pro Request).
  PERFORM set_config('app.bypass_self_change', 'on', true);

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

  -- Flag direkt wieder zurücksetzen (Sicherheit), bevor andere Updates folgen
  PERFORM set_config('app.bypass_self_change', 'off', true);

  -- Anfrage als genehmigt markieren
  UPDATE public.mannschaftsanfragen
  SET status = 'genehmigt',
      bearbeitet_von = auth.uid(),
      bearbeitet_am  = now()
  WHERE id = anfrage_id;
END;
$function$;
