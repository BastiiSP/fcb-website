-- Migration: Nachschärfung aus dem rls-rollen-reviewer (2026-09-24)
--
-- 1. prevent_fremdprofil_aenderung: Die Eigenprofil-Ausnahme prüfte
--    auth.uid() = NEW.id. Würde ein Vorstand bei einer fremden Zeile die id auf
--    seine eigene UID setzen, wäre der Trigger übersprungen. Praktisch scheitert
--    das an PK/FK, trotzdem gehört die Ausnahme an die UNVERÄNDERTE Zeile.
create or replace function public.prevent_fremdprofil_aenderung()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() = 'service_role'
     or current_setting('app.bypass_self_change', true) = 'on'
     or coalesce(public.get_own_rolle(), '') = 'admin'
     or (auth.uid() = old.id and old.id = new.id) then
    return new;
  end if;

  -- Ein Vorstand darf an fremden Profilen nur die Rolle ändern; updated_at
  -- pflegt der bestehende Zeitstempel-Trigger.
  if (to_jsonb(new) - 'rolle' - 'updated_at')
       is distinct from
     (to_jsonb(old) - 'rolle' - 'updated_at') then
    raise exception 'Vorstand darf bei fremden Profilen nur die Rolle ändern.';
  end if;

  return new;
end;
$$;

revoke execute on function public.prevent_fremdprofil_aenderung()
  from public, anon, authenticated;

-- 2. Baseline: Die folgenden zwei Funktionen existierten live, waren aber nicht
--    versioniert. Wortgleich zur Live-Definition vom 2026-09-24 eingecheckt,
--    damit Reviews sie prüfen können. Sicherheitsrelevant:
--    - approve_mannschaftsanfrage prüft ZUERST vorstand/admin und setzt den
--      Bypass-Schalter erst danach, transaktionslokal (set_config(..., true)) –
--      er kann also nicht über den Connection-Pool in fremde Requests wandern.
--    - prevent_self_role_change ist der einzige Schutz gegen Selbst-Eskalation
--      mitglied → trainer (der Eskalations-Trigger deckt nur vorstand/admin ab).
create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

create or replace function public.approve_mannschaftsanfrage(anfrage_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
$$;
