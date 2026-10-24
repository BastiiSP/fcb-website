-- Passwort-vergessen-Flow und vereinsabhängige Systemmails (Variante A, 24.10.2026)
--
-- Trägt für Bestandskonten die Mail-Marker in user_metadata nach, die neue
-- Registrierungen seitdem selbst setzen (src/app/registrieren/page.tsx):
--   passwort_login: Nur mit diesem Marker enthält die Reset-Mail einen Link
--                   (supabase/templates/reset-password.html). Reine Google-Konten
--                   bekommen ihn nicht und erhalten so kein Website-Passwort.
--   verein:         Mailmarke (FCB/JFG). Nur übernommen, wenn profiles.verein
--                   genau einen Verein enthält; Konten beider Vereine behalten die
--                   neutrale Mail.
--
-- WICHTIG: Beide Werte steuern ausschließlich den Mailinhalt. Rechte und die
-- Vereinstrennung hängen weiter allein an profiles.rolle/profiles.verein und RLS.
-- user_metadata ist vom Nutzer selbst änderbar und darf nie für Berechtigungen
-- gelesen werden.
--
-- Reihenfolge: erst NACH dem Deploy des Registrierungs-Codes anwenden, damit
-- zwischenzeitliche Registrierungen mit erfasst werden. Idempotent, darf
-- wiederholt werden. Keine Änderung an public.profiles, daher greifen die
-- profiles-Trigger hier nicht.

-- Passwortkonten = Konten mit E-Mail-Identität (Bestand 24.10.: 6, keine gemischten).
update auth.users u
set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('passwort_login', true)
where exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  )
  and (u.raw_user_meta_data ->> 'passwort_login') is distinct from 'true';

-- Vereinsmarke aus dem Profil, nur bei eindeutiger Zuordnung und ohne einen
-- vorhandenen Wert zu überschreiben. Gilt auch für Google-Konten, damit deren
-- linkfreie Reset-Mail die richtige Marke trägt.
update auth.users u
set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('verein', p.verein[1])
from public.profiles p
where p.id = u.id
  and cardinality(p.verein) = 1
  and p.verein[1] in ('fcb', 'jfg')
  and coalesce(u.raw_user_meta_data ->> 'verein', '') = '';
