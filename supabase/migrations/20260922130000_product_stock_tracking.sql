-- Track stock on hand for store products (src/lib/products.ts holds the catalog
-- itself — name, price, image; this table only tracks the numbers that change).
CREATE TABLE public.products (
  id TEXT PRIMARY KEY,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view product stock" ON public.products
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage product stock" ON public.products
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed a starting stock count for the current catalog (src/lib/products.ts) so
-- the report has real numbers immediately; the admin can adjust from there.
INSERT INTO public.products (id, stock_quantity, low_stock_threshold) VALUES
  ('air-fresheners', 50, 10),
  ('wiper-blades', 50, 10),
  ('rubber-mats', 30, 5),
  ('carpet-mats', 30, 5)
ON CONFLICT (id) DO NOTHING;

-- Atomically deducts sold quantities after a paid order. Called by the
-- verify-paystack-payment edge function with the service role, which bypasses
-- RLS — the explicit grant below is the only thing authorizing that call.
CREATE OR REPLACE FUNCTION public.record_order_stock(_items JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item JSONB;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    UPDATE public.products
    SET stock_quantity = GREATEST(stock_quantity - GREATEST(COALESCE((item->>'qty')::integer, 0), 0), 0),
        updated_at = now()
    WHERE id = item->>'id';
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.record_order_stock(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_order_stock(JSONB) TO service_role;

-- So the admin's live stock view updates the moment an order is paid.
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
