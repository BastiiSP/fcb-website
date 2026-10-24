# Gesicherte Original-Mailvorlagen (Stand 24.10.2026)

Rücknahmestand vor der Umstellung auf die vereinsabhängigen Vorlagen in `supabase/templates/`. Aus dem Supabase-Dashboard (Authentication → Emails → Templates) ausgelesen.

| Datei | Dashboard-Vorlage | Betreff |
| --- | --- | --- |
| `confirm-signup.html` | Confirm sign up | `Bitte bestätige deine E-Mail-Adresse – 1. FC 1911 Burgkunstadt` |
| `change-email.html` | Change email address | `Neue E-Mail-Adresse bestätigen – 1. FC 1911 Burgkunstadt` |
| `reset-password.html` | Reset password | `Passwort zurücksetzen – 1. FC 1911 Burgkunstadt` |

Die alten Vorlagen nutzen `{{ .ConfirmationURL }}` (Verify-Endpunkt von Supabase).

- Confirm sign up / Change email: `/confirm-email` versteht dieses Format weiterhin – Rücknahme ohne Code-Rückbau möglich.
- Reset password: `/passwort-neu` akzeptiert bewusst nur `token_hash` (sonst könnte jede eingeloggte Sitzung dort ohne Re-Authentifizierung ein Passwort setzen). Mit der alten Reset-Vorlage endet der Link deshalb bei „Link ungültig“ – diese Vorlage nur zusammen mit einem Code-Rückbau zurücknehmen.
