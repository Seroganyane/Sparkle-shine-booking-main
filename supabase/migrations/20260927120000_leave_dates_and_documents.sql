-- Extends staff leave requests with a proper date range, day count, an
-- optional supporting document at application time, and — for sick leave —
-- a required sick note submitted after the employee returns.
CREATE TYPE public.staff_leave_type AS ENUM ('sick', 'annual', 'other');

-- Requests: what the employee is asking for.
ALTER TABLE public.staff_leave_requests
  ADD COLUMN leave_type public.staff_leave_type NOT NULL DEFAULT 'other',
  ADD COLUMN start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN end_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN attachment_path TEXT;
ALTER TABLE public.staff_leave_requests ALTER COLUMN leave_type DROP DEFAULT;
ALTER TABLE public.staff_leave_requests ALTER COLUMN start_date DROP DEFAULT;
ALTER TABLE public.staff_leave_requests ALTER COLUMN end_date DROP DEFAULT;
ALTER TABLE public.staff_leave_requests ADD COLUMN days_count INT GENERATED ALWAYS AS ((end_date - start_date) + 1) STORED;
ALTER TABLE public.staff_leave_requests ADD CONSTRAINT staff_leave_requests_dates_valid CHECK (end_date >= start_date);

-- Active/past leave: carries the same fields through from the approved
-- request (or admin-started leave, where dates are optional — an admin can
-- still put someone on leave immediately without picking dates), plus the
-- post-return sick note obligation.
ALTER TABLE public.staff_leave
  ADD COLUMN leave_type public.staff_leave_type NOT NULL DEFAULT 'other',
  ADD COLUMN start_date DATE,
  ADD COLUMN end_date DATE,
  ADD COLUMN attachment_path TEXT,
  ADD COLUMN sick_note_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN sick_note_path TEXT,
  ADD COLUMN sick_note_submitted_at TIMESTAMPTZ;
ALTER TABLE public.staff_leave ADD COLUMN days_count INT GENERATED ALWAYS AS (
  CASE WHEN start_date IS NOT NULL AND end_date IS NOT NULL THEN (end_date - start_date) + 1 END
) STORED;

-- Private bucket for leave documents (doctor's notes, sick notes) — never public.
INSERT INTO storage.buckets (id, name, public) VALUES ('leave-documents', 'leave-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Each employee can only read/write inside their own folder (leave-documents/<user_id>/...);
-- admins can read every folder to review submissions.
CREATE POLICY "Staff upload their own leave documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'leave-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Staff view their own leave documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'leave-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Admins view all leave documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'leave-documents' AND public.has_role(auth.uid(), 'admin'));

-- Both functions below are changing their parameter list, which in Postgres
-- creates a new overload rather than replacing the old one — drop the old
-- signatures first so callers can't accidentally resolve to them, and so
-- there's only ever one version of each callable.
DROP FUNCTION IF EXISTS public.request_staff_leave(TEXT);
DROP FUNCTION IF EXISTS public.start_staff_leave(UUID, TEXT, UUID);

-- request_staff_leave: now takes the date range, leave type, and an optional
-- attachment uploaded to the bucket above before this call.
CREATE OR REPLACE FUNCTION public.request_staff_leave(
  _reason TEXT, _leave_type public.staff_leave_type, _start_date DATE, _end_date DATE, _attachment_path TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_id UUID;
  requester_name TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'employee') THEN RAISE EXCEPTION 'Only staff accounts can request leave.'; END IF;
  IF trim(COALESCE(_reason, '')) = '' THEN RAISE EXCEPTION 'Tell your admin why you need leave.'; END IF;
  IF _start_date IS NULL OR _end_date IS NULL THEN RAISE EXCEPTION 'Choose a start and end date.'; END IF;
  IF _end_date < _start_date THEN RAISE EXCEPTION 'The end date cannot be before the start date.'; END IF;
  IF _attachment_path IS NOT NULL AND (storage.foldername(_attachment_path))[1] <> auth.uid()::text THEN
    RAISE EXCEPTION 'That attachment does not belong to you.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.staff_leave WHERE employee_id = auth.uid() AND ended_at IS NULL) THEN
    RAISE EXCEPTION 'You are already on leave.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.staff_leave_requests WHERE employee_id = auth.uid() AND status = 'pending') THEN
    RAISE EXCEPTION 'You already have a leave request waiting for a decision.';
  END IF;

  INSERT INTO public.staff_leave_requests (employee_id, reason, leave_type, start_date, end_date, attachment_path)
  VALUES (auth.uid(), trim(_reason), _leave_type, _start_date, _end_date, _attachment_path)
  RETURNING id INTO new_id;

  SELECT COALESCE(NULLIF(full_name, ''), email, 'A staff member') INTO requester_name FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT user_id, 'Leave request from ' || requester_name,
    requester_name || ' requested ' || _leave_type || ' leave from ' || to_char(_start_date, 'DD Mon YYYY') || ' to ' ||
      to_char(_end_date, 'DD Mon YYYY') || ' (' || ((_end_date - _start_date) + 1) || ' day(s)): ' || trim(_reason) ||
      CASE WHEN _attachment_path IS NOT NULL THEN ' — a supporting document was attached.' ELSE '' END,
    'leave_request'
  FROM public.user_roles WHERE role = 'admin';

  RETURN new_id;
END;
$$;

-- start_staff_leave: unchanged for the existing admin "put on leave now"
-- action (new params default to an open-ended, untyped leave), but now also
-- used by approve_staff_leave_request to carry the request's real details
-- through onto the resulting staff_leave row.
CREATE OR REPLACE FUNCTION public.start_staff_leave(
  _employee_id UUID, _reason TEXT, _covering_employee_id UUID DEFAULT NULL,
  _leave_type public.staff_leave_type DEFAULT 'other', _start_date DATE DEFAULT CURRENT_DATE, _end_date DATE DEFAULT NULL,
  _attachment_path TEXT DEFAULT NULL
)
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

  INSERT INTO public.staff_leave (employee_id, slot_number, covering_employee_id, reason, created_by, leave_type, start_date, end_date, attachment_path)
  VALUES (_employee_id, employee_slot.slot_number, _covering_employee_id, NULLIF(trim(_reason), ''), auth.uid(), _leave_type, _start_date, _end_date, _attachment_path)
  RETURNING id INTO new_leave_id;

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

-- approve_staff_leave_request: pass the request's real type/dates/attachment
-- through onto the resulting staff_leave row instead of leaving it generic.
CREATE OR REPLACE FUNCTION public.approve_staff_leave_request(_request_id UUID, _covering_employee_id UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  request_row public.staff_leave_requests;
  new_leave_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can approve leave requests.'; END IF;
  SELECT * INTO request_row FROM public.staff_leave_requests WHERE id = _request_id AND status = 'pending' FOR UPDATE;
  IF request_row.id IS NULL THEN RAISE EXCEPTION 'This request has already been decided.'; END IF;

  new_leave_id := public.start_staff_leave(
    request_row.employee_id, request_row.reason, _covering_employee_id,
    request_row.leave_type, request_row.start_date, request_row.end_date, request_row.attachment_path
  );

  UPDATE public.staff_leave_requests
  SET status = 'approved', decided_at = now(), decided_by = auth.uid(), resulting_leave_id = new_leave_id
  WHERE id = _request_id;

  RETURN new_leave_id;
END;
$$;

-- end_staff_leave: sick leave now leaves behind a "submit your sick note"
-- obligation on the same row, tracked past the point it's no longer active.
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
  UPDATE public.staff_leave
  SET ended_at = now(), ended_by = auth.uid(), sick_note_required = (leave_row.leave_type = 'sick')
  WHERE id = _leave_id;

  INSERT INTO public.notifications (user_id, title, message, type) VALUES (
    leave_row.employee_id, 'Welcome back',
    'Your leave has ended. You are assigned to Wash Bay #' || leave_row.slot_number || ' again.' ||
      CASE WHEN leave_row.leave_type = 'sick' THEN ' Please submit your sick note.' ELSE '' END,
    'staff_leave'
  );
END;
$$;

-- Lets a returning employee attach their sick note to the ended leave record
-- that required one.
CREATE OR REPLACE FUNCTION public.submit_sick_note(_leave_id UUID, _file_path TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  leave_row public.staff_leave;
  submitter_name TEXT;
BEGIN
  SELECT * INTO leave_row FROM public.staff_leave WHERE id = _leave_id AND employee_id = auth.uid() FOR UPDATE;
  IF leave_row.id IS NULL THEN RAISE EXCEPTION 'Leave record not found.'; END IF;
  IF NOT leave_row.sick_note_required THEN RAISE EXCEPTION 'No sick note is required for this leave.'; END IF;
  IF leave_row.sick_note_path IS NOT NULL THEN RAISE EXCEPTION 'A sick note has already been submitted for this leave.'; END IF;
  IF trim(COALESCE(_file_path, '')) = '' THEN RAISE EXCEPTION 'Attach your sick note file first.'; END IF;
  IF (storage.foldername(_file_path))[1] <> auth.uid()::text THEN RAISE EXCEPTION 'That file does not belong to you.'; END IF;

  UPDATE public.staff_leave SET sick_note_path = _file_path, sick_note_submitted_at = now() WHERE id = _leave_id;

  SELECT COALESCE(NULLIF(full_name, ''), email, 'A staff member') INTO submitter_name FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT user_id, 'Sick note submitted', submitter_name || ' submitted their sick note.', 'staff_leave'
  FROM public.user_roles WHERE role = 'admin';
END;
$$;

REVOKE ALL ON FUNCTION public.request_staff_leave(TEXT, public.staff_leave_type, DATE, DATE, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_staff_leave(UUID, TEXT, UUID, public.staff_leave_type, DATE, DATE, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_staff_leave_request(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.end_staff_leave(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_sick_note(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_staff_leave(TEXT, public.staff_leave_type, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_staff_leave(UUID, TEXT, UUID, public.staff_leave_type, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_staff_leave_request(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_staff_leave(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_sick_note(UUID, TEXT) TO authenticated;
