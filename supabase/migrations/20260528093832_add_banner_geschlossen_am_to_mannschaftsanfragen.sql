-- Neue Spalte: Timestamp, wann der Nutzer den Banner für diese abgelehnte Anfrage geschlossen hat.
-- NULL = Banner wird noch angezeigt; gesetzt = Banner ausgeblendet (geräteübergreifend).
ALTER TABLE public.mannschaftsanfragen
  ADD COLUMN IF NOT EXISTS banner_geschlossen_am TIMESTAMPTZ;

-- RPC zum Schließen des Banners. SECURITY DEFINER umgeht die Standard-UPDATE-RLS,
-- deshalb ist die WHERE-Klausel strikt: nur eigene + abgelehnte Zeilen dürfen markiert werden.
CREATE OR REPLACE FUNCTION public.close_mannschaftsanfrage_banner(anfrage_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.mannschaftsanfragen
     SET banner_geschlossen_am = NOW()
   WHERE id = anfrage_id
     AND user_id = auth.uid()
     AND status = 'abgelehnt'
     AND banner_geschlossen_am IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_mannschaftsanfrage_banner(UUID) TO authenticated;
