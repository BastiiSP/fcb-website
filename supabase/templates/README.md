# Entwürfe für Supabase-Auth-Mails

Diese versionierten HTML-Entwürfe gehören in **Supabase-Dashboard → Authentication → Email Templates**:

| Datei | Dashboard-Vorlage |
| --- | --- |
| `reset-password.html` | Reset password |
| `change-email.html` | Change email |
| `confirm-signup.html` | Confirm signup |

Die Betreff-Felder stehen in `betreffzeilen.md`. Für alle Vorlagen denselben SMTP-Absender mit dem Anzeigenamen **FCB & JFG – Vereinsportal** verwenden.

Erst nach dem Deploy des zu den Links und Markern passenden Codes aktivieren: **Reset password**, danach **Change email**, zuletzt **Confirm signup**. Vorher die Redirect-Allowlist für beide Produktionsdomains, Vercel-Preview und localhost prüfen, jeweils einschließlich `/confirm-email` und `/passwort-neu`. Die Links verwenden immer `RedirectTo` der aufrufenden Domain; nur falls es fehlt, greifen sie auf `SiteURL` mit dem jeweiligen Pfad zurück. Die Mailmarke bestimmt keine Rücksprungdomain. Steht eine Rücksprung-URL nicht auf der Allowlist, setzt Supabase `RedirectTo` auf die Site URL ohne Pfad; `src/proxy.ts` leitet `/?token_hash=…` dann auf `/passwort-neu` bzw. `/confirm-email` weiter (Notbehelf, die Allowlist bleibt Voraussetzung für die richtige Domain).

Bekannte Grenze: Ein bereits eingeloggter Nutzer kann über die Supabase-API selbst ein Passwort setzen; das sperren weder Vorlagen noch Seiten (bewusst hingenommen, Entscheidung E3 vom 24.10.2026). Neue Google-Konten erhalten `verein` beim ersten Login aus der aufrufenden Domain (`src/app/auth/callback/page.tsx`).

Für die Rücknahme legt Basti die gesicherten Originalvorlagen unter `supabase/templates/alt/` ab und kann sie im Dashboard wieder einsetzen. Dieser Ordner gehört nicht zu den Entwürfen.

Die Marker `passwort_login` und `verein` liegen in `user_metadata` (`.Data`). Sie steuern ausschließlich den Mailinhalt und vergeben keine Rechte. Fehlt `verein` oder ist der Wert unbekannt, zeigt die Mail den neutralen Namen und beide Kontaktadressen. Vor Aktivierung alle Varianten im Dashboard prüfen, besonders den tokenfreien Reset-Zweig ohne Website-Passwortanmeldung.
