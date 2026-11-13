-- Ohne explizites GRANT greift die DELETE-Policy nie: Postgres bricht vorher mit
-- "permission denied" ab. RLS schränkt anschließend auf eigene offene Anfragen ein.
GRANT DELETE ON public.mannschaftsanfragen TO authenticated;
