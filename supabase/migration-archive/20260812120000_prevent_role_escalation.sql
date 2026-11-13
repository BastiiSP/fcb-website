-- Migration: prevent_role_escalation
-- Sicherheitsfix 2026-08-12: Die Regel "nur admin darf vorstand/admin vergeben"
-- war bisher nur clientseitig in BenutzerListe.tsx (ROLLEN_OPTIONEN) durchgesetzt.
-- Ein vorstand-Nutzer mit gültigem Token hätte per direktem API-Call
-- (Supabase-JS oder REST, an der UI vorbei) trotzdem versuchen können, sich
-- selbst oder andere auf vorstand/admin zu setzen, sofern die UPDATE-Policy
-- auf profiles das nicht schon ausschließt. Dieser Trigger erzwingt die Regel
-- zusätzlich auf DB-Ebene, unabhängig von der bestehenden RLS-Policy.
--
-- Ausgenommen: der bereits bestehende Self-Change-Schutz
-- (prevent_self_role_change) und der GUC-Flag-Bypass für
-- approve_mannschaftsanfrage bleiben unverändert von dieser Migration.

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Nur relevant, wenn sich die Rolle tatsächlich ändert und auf
  -- vorstand/admin gesetzt werden soll.
  if new.rolle is distinct from old.rolle
     and new.rolle = any (array['vorstand'::text, 'admin'::text]) then
    if coalesce(public.get_own_rolle(), '') <> 'admin' then
      raise exception 'Nur admin darf die Rolle vorstand/admin vergeben.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;

create trigger trg_prevent_role_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_role_escalation();
