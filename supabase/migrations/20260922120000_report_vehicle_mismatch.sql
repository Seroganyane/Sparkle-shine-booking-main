-- Let staff report that the vehicle in their bay is not the one that was booked,
-- so the admin is alerted and can assign the next car. Reporting frees the
-- employee's active assignment (same as finishing a wash) and returns the
-- booking to the queue for the admin to re-assign or follow up on.
ALTER TABLE public.employee_assignments
  ADD COLUMN mismatch_reported_at TIMESTAMPTZ,
  ADD COLUMN mismatch_scanned_plate TEXT;

CREATE OR REPLACE FUNCTION public.report_vehicle_mismatch(_assignment_id UUID, _scanned_plate TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  assignment_row public.employee_assignments;
  booking_row public.bookings;
  staff_name TEXT;
  normalized_scanned TEXT;
  normalized_booked TEXT;
BEGIN
  SELECT * INTO assignment_row FROM public.employee_assignments
  WHERE id = _assignment_id AND employee_id = auth.uid() AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active assignment not found'; END IF;
  IF assignment_row.accepted_at IS NULL THEN RAISE EXCEPTION 'Accept the booking before reporting the vehicle'; END IF;
  IF assignment_row.plate_verified_at IS NOT NULL THEN RAISE EXCEPTION 'This vehicle was already verified as correct'; END IF;

  SELECT * INTO booking_row FROM public.bookings WHERE id = assignment_row.booking_id FOR UPDATE;
  normalized_scanned := upper(regexp_replace(COALESCE(_scanned_plate, ''), '[^a-zA-Z0-9]', '', 'g'));
  normalized_booked := upper(regexp_replace(booking_row.car_plate, '[^a-zA-Z0-9]', '', 'g'));
  IF normalized_scanned <> '' AND normalized_scanned = normalized_booked THEN
    RAISE EXCEPTION 'This plate matches the booking. Use vehicle verification instead of reporting a mismatch.';
  END IF;

  UPDATE public.employee_assignments
  SET status = 'completed', completed_at = now(),
      mismatch_reported_at = now(), mismatch_scanned_plate = NULLIF(normalized_scanned, '')
  WHERE id = assignment_row.id;

  -- Send the booking back to the queue (not this bay) so the admin can decide
  -- what to do with it, without leaving it stuck as "in progress".
  UPDATE public.bookings
  SET status = CASE WHEN status IN ('completed', 'cancelled') THEN status ELSE 'in_queue' END,
      slot_number = NULL
  WHERE id = booking_row.id;

  SELECT COALESCE(full_name, email, 'A staff member') INTO staff_name FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT user_id, 'Wrong vehicle reported',
    staff_name || ' scanned the vehicle at Wash Bay #' || COALESCE(booking_row.slot_number::text, '?') ||
    ' and it does not match the booked plate ' || booking_row.car_plate ||
    COALESCE(' (scanned: ' || NULLIF(normalized_scanned, '') || ')', '') ||
    '. The booking has been returned to the queue — please assign the next car to ' || staff_name || '.',
    'vehicle_mismatch'
  FROM public.user_roles WHERE role = 'admin';
END;
$$;

REVOKE ALL ON FUNCTION public.report_vehicle_mismatch(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_vehicle_mismatch(UUID, TEXT) TO authenticated;
