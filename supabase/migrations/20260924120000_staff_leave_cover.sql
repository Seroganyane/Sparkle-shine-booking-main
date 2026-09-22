-- Lets an admin put a staff member on leave (sick leave etc.) and hand their
-- permanent wash bay to another available employee while they're away, then
-- hand it back when the leave ends. "Available" means an employee with no
-- permanent bay of their own and not already covering someone else's.
CREATE TABLE public.staff_leave (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_number INT NOT NULL CHECK (slot_number BETWEEN 1 AND 10),
  covering_employee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  ended_by UUID REFERENCES auth.users(id)
);

-- Only one open leave per employee, per slot, and per covering employee at a time.
CREATE UNIQUE INDEX one_active_leave_per_employee ON public.staff_leave (employee_id) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX one_active_leave_per_slot ON public.staff_leave (slot_number) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX one_active_cover_per_employee ON public.staff_leave (covering_employee_id) WHERE ended_at IS NULL AND covering_employee_id IS NOT NULL;

ALTER TABLE public.staff_leave ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage staff leave" ON public.staff_leave
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff view their own leave records" ON public.staff_leave
  FOR SELECT TO authenticated USING (auth.uid() = employee_id OR auth.uid() = covering_employee_id);

-- Puts an employee on leave. If a covering employee is given, they must
-- currently have no permanent bay and not already be covering someone else —
-- i.e. actually available to physically staff a bay right now.
CREATE OR REPLACE FUNCTION public.start_staff_leave(_employee_id UUID, _reason TEXT, _covering_employee_id UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  employee_slot public.employee_slots;
  new_leave_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can manage staff leave.'; END IF;
  IF NOT public.has_role(_employee_id, 'employee') THEN RAISE EXCEPTION 'That account is not a staff member.'; END IF;
  IF EXISTS (SELECT 1 FROM public.staff_leave WHERE employee_id = _employee_id AND ended_at IS NULL) THEN
    RAISE EXCEPTION 'This staff member is already on leave.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.employee_assignments WHERE employee_id = _employee_id AND status = 'active') THEN
    RAISE EXCEPTION 'Finish or reassign their current booking before starting leave.';
  END IF;

  SELECT * INTO employee_slot FROM public.employee_slots WHERE employee_id = _employee_id;
  IF employee_slot.slot_number IS NULL THEN RAISE EXCEPTION 'This staff member has no permanent wash bay to cover.'; END IF;

  IF _covering_employee_id IS NOT NULL THEN
    IF _covering_employee_id = _employee_id THEN RAISE EXCEPTION 'Choose a different staff member to cover this bay.'; END IF;
    IF NOT public.has_role(_covering_employee_id, 'employee') THEN RAISE EXCEPTION 'The covering account is not a staff member.'; END IF;
    IF EXISTS (SELECT 1 FROM public.employee_slots WHERE employee_id = _covering_employee_id) THEN
      RAISE EXCEPTION 'That staff member already has their own permanent bay.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.staff_leave WHERE employee_id = _covering_employee_id AND ended_at IS NULL) THEN
      RAISE EXCEPTION 'That staff member is currently on leave themselves.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.staff_leave WHERE covering_employee_id = _covering_employee_id AND ended_at IS NULL) THEN
      RAISE EXCEPTION 'That staff member is already covering another bay.';
    END IF;
  END IF;

  INSERT INTO public.staff_leave (employee_id, slot_number, covering_employee_id, reason, created_by)
  VALUES (_employee_id, employee_slot.slot_number, _covering_employee_id, NULLIF(trim(_reason), ''), auth.uid())
  RETURNING id INTO new_leave_id;

  -- Hand the bay to the cover (or vacate it) and free the employee going on leave.
  IF _covering_employee_id IS NOT NULL THEN
    UPDATE public.employee_slots SET employee_id = _covering_employee_id WHERE slot_number = employee_slot.slot_number;
    UPDATE public.profiles SET assigned_slot_number = employee_slot.slot_number WHERE id = _covering_employee_id;
  ELSE
    DELETE FROM public.employee_slots WHERE slot_number = employee_slot.slot_number;
  END IF;
  UPDATE public.profiles SET assigned_slot_number = NULL WHERE id = _employee_id;

  INSERT INTO public.notifications (user_id, title, message, type) VALUES
    (_employee_id, 'You are on leave', 'You have been marked on leave from Wash Bay #' || employee_slot.slot_number || '. Your supervisor will restore your bay when you are back.', 'staff_leave');
  IF _covering_employee_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type) VALUES
      (_covering_employee_id, 'Covering Wash Bay #' || employee_slot.slot_number, 'You are now covering Wash Bay #' || employee_slot.slot_number || ' while a colleague is on leave.', 'staff_leave');
  END IF;

  RETURN new_leave_id;
END;
$$;

-- Assigns (or replaces) the covering employee for a leave that is already
-- under way — for when nobody was available yet when the leave started.
CREATE OR REPLACE FUNCTION public.assign_leave_cover(_leave_id UUID, _covering_employee_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE leave_row public.staff_leave;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can manage staff leave.'; END IF;
  SELECT * INTO leave_row FROM public.staff_leave WHERE id = _leave_id AND ended_at IS NULL FOR UPDATE;
  IF leave_row.id IS NULL THEN RAISE EXCEPTION 'This leave record is not active.'; END IF;
  IF _covering_employee_id = leave_row.employee_id THEN RAISE EXCEPTION 'Choose a different staff member to cover this bay.'; END IF;
  IF NOT public.has_role(_covering_employee_id, 'employee') THEN RAISE EXCEPTION 'The covering account is not a staff member.'; END IF;
  IF EXISTS (SELECT 1 FROM public.employee_slots WHERE employee_id = _covering_employee_id) THEN
    RAISE EXCEPTION 'That staff member already has their own permanent bay.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.staff_leave WHERE employee_id = _covering_employee_id AND ended_at IS NULL) THEN
    RAISE EXCEPTION 'That staff member is currently on leave themselves.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.staff_leave WHERE covering_employee_id = _covering_employee_id AND ended_at IS NULL AND id <> _leave_id) THEN
    RAISE EXCEPTION 'That staff member is already covering another bay.';
  END IF;

  IF leave_row.covering_employee_id IS NOT NULL THEN
    UPDATE public.profiles SET assigned_slot_number = NULL WHERE id = leave_row.covering_employee_id;
    UPDATE public.employee_slots SET employee_id = _covering_employee_id WHERE slot_number = leave_row.slot_number;
  ELSE
    INSERT INTO public.employee_slots (employee_id, slot_number) VALUES (_covering_employee_id, leave_row.slot_number);
  END IF;
  UPDATE public.profiles SET assigned_slot_number = leave_row.slot_number WHERE id = _covering_employee_id;
  UPDATE public.staff_leave SET covering_employee_id = _covering_employee_id WHERE id = _leave_id;

  INSERT INTO public.notifications (user_id, title, message, type) VALUES
    (_covering_employee_id, 'Covering Wash Bay #' || leave_row.slot_number, 'You are now covering Wash Bay #' || leave_row.slot_number || ' while a colleague is on leave.', 'staff_leave');
END;
$$;

-- Ends a leave and hands the bay back to the employee who was away.
CREATE OR REPLACE FUNCTION public.end_staff_leave(_leave_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE leave_row public.staff_leave;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can manage staff leave.'; END IF;
  SELECT * INTO leave_row FROM public.staff_leave WHERE id = _leave_id AND ended_at IS NULL FOR UPDATE;
  IF leave_row.id IS NULL THEN RAISE EXCEPTION 'This leave record is not active.'; END IF;

  IF leave_row.covering_employee_id IS NOT NULL THEN
    UPDATE public.profiles SET assigned_slot_number = NULL WHERE id = leave_row.covering_employee_id;
    UPDATE public.employee_slots SET employee_id = leave_row.employee_id WHERE slot_number = leave_row.slot_number;
    INSERT INTO public.notifications (user_id, title, message, type) VALUES
      (leave_row.covering_employee_id, 'Cover assignment ended', 'Your cover for Wash Bay #' || leave_row.slot_number || ' has ended — thank you for stepping in.', 'staff_leave');
  ELSE
    INSERT INTO public.employee_slots (employee_id, slot_number) VALUES (leave_row.employee_id, leave_row.slot_number);
  END IF;
  UPDATE public.profiles SET assigned_slot_number = leave_row.slot_number WHERE id = leave_row.employee_id;
  UPDATE public.staff_leave SET ended_at = now(), ended_by = auth.uid() WHERE id = _leave_id;

  INSERT INTO public.notifications (user_id, title, message, type) VALUES
    (leave_row.employee_id, 'Welcome back', 'Your leave has ended. You are assigned to Wash Bay #' || leave_row.slot_number || ' again.', 'staff_leave');
END;
$$;

REVOKE ALL ON FUNCTION public.start_staff_leave(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_leave_cover(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.end_staff_leave(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_staff_leave(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_leave_cover(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_staff_leave(UUID) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_leave;
