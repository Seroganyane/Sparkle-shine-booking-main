-- Verify an arriving vehicle against its booking and alert all administrators.
ALTER TABLE public.employee_assignments
  ADD COLUMN plate_verified_at TIMESTAMPTZ,
  ADD COLUMN scanned_plate TEXT;

CREATE OR REPLACE FUNCTION public.verify_employee_vehicle(_assignment_id UUID, _scanned_plate TEXT)
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
  IF assignment_row.accepted_at IS NULL THEN RAISE EXCEPTION 'Accept the booking before verifying the vehicle'; END IF;
  IF assignment_row.plate_verified_at IS NOT NULL THEN RAISE EXCEPTION 'This vehicle has already been verified'; END IF;

  SELECT * INTO booking_row FROM public.bookings WHERE id = assignment_row.booking_id;
  normalized_scanned := upper(regexp_replace(COALESCE(_scanned_plate, ''), '[^a-zA-Z0-9]', '', 'g'));
  normalized_booked := upper(regexp_replace(booking_row.car_plate, '[^a-zA-Z0-9]', '', 'g'));
  IF normalized_scanned = '' OR normalized_scanned <> normalized_booked THEN
    RAISE EXCEPTION 'Number plate does not match this booking';
  END IF;

  UPDATE public.employee_assignments
  SET plate_verified_at = now(), scanned_plate = normalized_scanned
  WHERE id = assignment_row.id;

  SELECT COALESCE(full_name, email, 'Staff member') INTO staff_name
  FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT user_id, 'Customer vehicle verified',
    staff_name || ' verified number plate ' || booking_row.car_plate ||
    ' for Wash Bay #' || COALESCE(booking_row.slot_number::text, '') ||
    '. It is the correct customer vehicle.', 'vehicle_verified'
  FROM public.user_roles WHERE role = 'admin';
END;
$$;

REVOKE ALL ON FUNCTION public.verify_employee_vehicle(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_employee_vehicle(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_employee_assignment(_assignment_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE assignment_row public.employee_assignments; employee_name TEXT;
BEGIN
  SELECT * INTO assignment_row FROM public.employee_assignments
  WHERE id = _assignment_id AND employee_id = auth.uid() AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active assignment not found'; END IF;
  IF assignment_row.accepted_at IS NULL THEN RAISE EXCEPTION 'Accept the booking before completing the wash'; END IF;
  IF assignment_row.plate_verified_at IS NULL THEN RAISE EXCEPTION 'Verify the vehicle number plate before completing the wash'; END IF;
  UPDATE public.employee_assignments SET status = 'completed', completed_at = now() WHERE id = _assignment_id;
  UPDATE public.bookings SET status = 'completed' WHERE id = assignment_row.booking_id;
  SELECT COALESCE(full_name, 'An employee') INTO employee_name FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT user_id, 'Employee available', employee_name || ' finished a wash and is ready for the next car.', 'employee_availability'
  FROM public.user_roles WHERE role = 'admin';
END;
$$;
