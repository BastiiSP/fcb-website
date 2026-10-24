# Betreffzeilen für Supabase Auth

Die Bedingungen gehören jeweils in das Betreff-Feld derselben Vorlage im Supabase-Dashboard.

| Vorlage | Betreff mit Vereinsunterscheidung | Neutraler Fallback |
| --- | --- | --- |
| Confirm signup | `Bestätige deine E-Mail-Adresse – {{ if and .Data.verein (eq .Data.verein "fcb") }}FCB{{ else if and .Data.verein (eq .Data.verein "jfg") }}JFG{{ else }}FCB & JFG Vereinsportal{{ end }}` | `Bestätige deine E-Mail-Adresse – FCB & JFG Vereinsportal` |
| Reset password | `Passwort zurücksetzen – {{ if and .Data.verein (eq .Data.verein "fcb") }}FCB{{ else if and .Data.verein (eq .Data.verein "jfg") }}JFG{{ else }}FCB & JFG Vereinsportal{{ end }}` | `Passwort zurücksetzen – FCB & JFG Vereinsportal` |
| Change email | `E-Mail-Änderung bestätigen – {{ if and .Data.verein (eq .Data.verein "fcb") }}FCB{{ else if and .Data.verein (eq .Data.verein "jfg") }}JFG{{ else }}FCB & JFG Vereinsportal{{ end }}` | `E-Mail-Änderung bestätigen – FCB & JFG Vereinsportal` |

Vor der Aktivierung im Dashboard per Vorschau prüfen, ob das Betreff-Feld Template-Bedingungen auswertet. Falls nicht, den jeweiligen neutralen Fallback verwenden. Der SMTP-Anzeigename ist für alle Vorlagen gleich: „FCB & JFG – Vereinsportal“.
