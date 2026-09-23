-- Bug: the admin "assign employee to booking" action did a raw INSERT into
-- employee_assignments. Two unique indexes guard that table on purpose — one
-- booking can't have two active assignments, and one employee can't be
-- actively assigned to two bookings — but the client never checked either
-- case first, so trying to assign a booking that already has someone
-- assigned (e.g. correcting a mistake, or reassigning after the original
-- employee went on leave) failed with a raw Postgres constraint error
-- instead of either being blocked cleanly or actually reassigning.
--
-- Fix: a proper RPC that reassigns cleanly when the booking already has an
-- active assignment (closing out the old one), and gives a clear message
-- for the other unique constraint (the chosen employee is already busy
-- elsewhere) instead of a raw duplicate-key error either way.
CREATE OR REPLACE FUNCTION public.admin_assign_employee(_booking_id UUID, _employee_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  booking_row public.bookings;
  existing_assignment public.employee_assignments;
  employee_slot_number INT;
  target_slot INT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can assign employees to bookings.'; END IF;
  IF NOT public.has_role(_employee_id, 'employee') THEN RAISE EXCEPTION 'That account is not a staff member.'; END IF;

  SELECT * INTO booking_row FROM public.bookings WHERE id = _booking_id FOR UPDATE;
  IF booking_row.id IS NULL THEN RAISE EXCEPTION 'Booking not found.'; END IF;
  IF booking_row.status IN ('completed', 'cancelled') THEN RAISE EXCEPTION 'This booking is already %.', booking_row.status; END IF;

  IF EXISTS (SELECT 1 FROM public.staff_leave WHERE employee_id = _employee_id AND ended_at IS NULL) THEN
    RAISE EXCEPTION 'That staff member is currently on leave.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.employee_assignments
    WHERE employee_id = _employee_id AND status = 'active' AND booking_id <> _booking_id
  ) THEN
    RAISE EXCEPTION 'That staff member already has another active booking assigned to them.';
  END IF;

  SELECT * INTO existing_assignment FROM public.employee_assignments WHERE booking_id = _booking_id AND status = 'active' FOR UPDATE;
  IF existing_assignment.id IS NOT NULL THEN
    IF existing_assignment.employee_id = _employee_id THEN
      RAISE EXCEPTION 'This booking is already assigned to that staff member.';
    END IF;
    -- Reassigning: close out the previous assignment so the new one can take over.
    UPDATE public.employee_assignments SET status = 'completed', completed_at = now() WHERE id = existing_assignment.id;
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      existing_assignment.employee_id, 'Booking reassigned',
      'The ' || COALESCE(booking_row.car_make, '') || ' ' || COALESCE(booking_row.car_model, '') ||
        ' (' || COALESCE(booking_row.car_plate, '') || ') has been reassigned to another staff member.',
      'booking_assigned'
    );
  END IF;

  SELECT slot_number INTO employee_slot_number FROM public.employee_slots WHERE employee_id = _employee_id;
  target_slot := COALESCE(booking_row.slot_number, employee_slot_number);
  IF target_slot IS NULL THEN RAISE EXCEPTION 'This booking has no available slot to assign.'; END IF;

  -- Firing this INSERT also runs the existing notify_employee_of_assignment
  -- trigger, which tells the newly assigned employee — no need to repeat it here.
  INSERT INTO public.employee_assignments (booking_id, employee_id, assigned_by, status)
  VALUES (_booking_id, _employee_id, auth.uid(), 'active');

  UPDATE public.bookings SET status = 'in_progress', slot_number = target_slot WHERE id = _booking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assign_employee(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_assign_employee(UUID, UUID) TO authenticated;
