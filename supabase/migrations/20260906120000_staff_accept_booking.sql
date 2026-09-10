-- This migration is already applied remotely; retained locally to keep migration history aligned.
ALTER TABLE public.employee_assignments ADD COLUMN accepted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.accept_employee_booking(_assignment_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE assignment_row public.employee_assignments; booking_row public.bookings;
BEGIN
  SELECT * INTO assignment_row FROM public.employee_assignments
  WHERE id = _assignment_id AND employee_id = auth.uid() AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active assignment not found'; END IF;
  IF assignment_row.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'This booking has already been accepted'; END IF;
  SELECT * INTO booking_row FROM public.bookings WHERE id = assignment_row.booking_id FOR UPDATE;
  IF booking_row.status IN ('completed', 'cancelled') THEN RAISE EXCEPTION 'This booking cannot be accepted in its current state'; END IF;
  UPDATE public.employee_assignments SET accepted_at = now() WHERE id = assignment_row.id;
  UPDATE public.bookings SET status = 'confirmed' WHERE id = booking_row.id;
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (booking_row.user_id, 'Booking accepted',
    'Your booking for Wash Bay #' || COALESCE(booking_row.slot_number::text, '') ||
    ' has been accepted. Please bring your ' || booking_row.car_make || ' ' ||
    booking_row.car_model || ' (' || booking_row.car_plate || ') to the car wash.', 'booking_accepted');
END;
$$;

REVOKE ALL ON FUNCTION public.accept_employee_booking(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_employee_booking(UUID) TO authenticated;
