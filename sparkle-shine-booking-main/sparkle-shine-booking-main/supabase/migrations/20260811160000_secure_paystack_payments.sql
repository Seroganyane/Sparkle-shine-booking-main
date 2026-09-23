CREATE TABLE public.paystack_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_type text NOT NULL CHECK (payment_type IN ('booking', 'order')),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  amount integer NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (payment_type = 'booking' AND booking_id IS NOT NULL AND order_id IS NULL) OR
    (payment_type = 'order' AND order_id IS NOT NULL AND booking_id IS NULL)
  )
);

ALTER TABLE public.paystack_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own Paystack payments"
  ON public.paystack_payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users view own orders"
  ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
