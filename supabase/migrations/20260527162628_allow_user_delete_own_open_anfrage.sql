-- Feature: User darf eigene noch offene Mannschaftsanfrage zurückziehen (= löschen).
-- Bisher existierte keine DELETE-Policy → niemand konnte Anfragen löschen.
-- Eingeschränkt auf eigene Zeilen mit status='offen'; genehmigte/abgelehnte bleiben
-- unantastbar.
CREATE POLICY "Eigene offene Anfragen loeschen"
  ON public.mannschaftsanfragen
  FOR DELETE
  USING (user_id = auth.uid() AND status = 'offen');
