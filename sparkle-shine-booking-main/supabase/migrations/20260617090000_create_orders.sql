-- Create orders table for product purchases
CREATE TABLE public.orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  items jsonb NOT NULL,
  total_amount numeric(10,2) NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
