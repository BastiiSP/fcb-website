# Archiv überholter Migrationsentwürfe

Diese Dateien werden vom Supabase-Migrationslauf nicht eingelesen.

`20260812120000_prevent_role_escalation.sql` hatte am 13.11.2026 keinen eigenen Eintrag in der produktiven Migrationshistorie. Seine Funktion und sein Trigger wurden durch die tatsächlich angewendete Migration `20260924151311_harden_profile_role_changes.sql` ersetzt. Die aktuelle Funktion stimmt mit dieser späteren Definition überein. Der archivierte Entwurf darf nicht nachträglich auf Produktion angewendet werden, weil er die spätere Absicherung des Rollenentzugs zurücksetzen würde.

