-- Declining a leave request must now come with a reason, not just a silent
-- rejection — the employee deserves to know why, and the check is enforced
-- here, not only in the UI, so it can't be skipped by calling the API directly.
-- Postgres won't let CREATE OR REPLACE drop an existing parameter default, so
-- the old (optional-notes) signature has to be dropped explicitly first.
DROP FUNCTION IF EXISTS public.decline_staff_leave_request(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.decline_staff_leave_request(_request_id UUID, _decision_notes TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE request_row public.staff_leave_requests;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can decline leave requests.'; END IF;
  IF trim(COALESCE(_decision_notes, '')) = '' THEN RAISE EXCEPTION 'Give a reason for declining this leave request.'; END IF;
  SELECT * INTO request_row FROM public.staff_leave_requests WHERE id = _request_id AND status = 'pending' FOR UPDATE;
  IF request_row.id IS NULL THEN RAISE EXCEPTION 'This request has already been decided.'; END IF;

  UPDATE public.staff_leave_requests
  SET status = 'declined', decided_at = now(), decided_by = auth.uid(), decision_notes = trim(_decision_notes)
  WHERE id = _request_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (request_row.employee_id, 'Leave request declined', 'Your leave request was declined: ' || trim(_decision_notes), 'leave_request');
END;
$$;
