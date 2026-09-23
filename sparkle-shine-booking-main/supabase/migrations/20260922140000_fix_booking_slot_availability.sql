-- Bug fix: a regular customer's RLS policy on bookings only lets them see their
-- OWN rows ("Users view own bookings"), but the chatbot and the booking dialog
-- both queried public.bookings directly to work out which wash bays were free.
-- Every customer other than an admin was seeing near-empty occupancy (only
-- their own past bookings), so the chatbot routinely offered wash bays that
-- were actually taken, and nothing on the server stopped the resulting insert.
--
-- Fix: a SECURITY DEFINER function that returns only the occupied slot numbers
-- (no customer names, cars, or plates — just which bays are busy), callable by
-- any signed-in user, plus a hard constraint so two live bookings can never
-- share a bay even if two people submit the same slot at the same moment.
CREATE OR REPLACE FUNCTION public.get_occupied_wash_slots()
RETURNS SETOF INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT slot_number FROM public.bookings
  WHERE slot_number IS NOT NULL AND status NOT IN ('completed', 'cancelled');
$$;

REVOKE ALL ON FUNCTION public.get_occupied_wash_slots() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_occupied_wash_slots() TO authenticated;

CREATE UNIQUE INDEX one_active_booking_per_slot ON public.bookings (slot_number)
  WHERE slot_number IS NOT NULL AND status NOT IN ('completed', 'cancelled');
