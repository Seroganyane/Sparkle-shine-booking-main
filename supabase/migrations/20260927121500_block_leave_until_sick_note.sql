-- Makes "must submit a sick note" a real gate: an employee who owes one from
-- a previous sick leave cannot apply for further leave until they submit it.
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
  IF EXISTS (SELECT 1 FROM public.staff_leave WHERE employee_id = auth.uid() AND sick_note_required AND sick_note_path IS NULL) THEN
    RAISE EXCEPTION 'Submit your outstanding sick note before requesting more leave.';
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
