-- Lets a staff member apply for leave themselves, instead of only an admin
-- being able to start it. The request goes to every admin for review; approving
-- it hands off the employee's bay exactly like an admin-started leave already
-- does (reusing start_staff_leave), optionally with a cover chosen on approval.
CREATE TYPE public.staff_leave_request_status AS ENUM ('pending', 'approved', 'declined');

CREATE TABLE public.staff_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status public.staff_leave_request_status NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES auth.users(id),
  decision_notes TEXT,
  resulting_leave_id UUID REFERENCES public.staff_leave(id) ON DELETE SET NULL
);

-- One open request per employee at a time.
CREATE UNIQUE INDEX one_pending_leave_request_per_employee ON public.staff_leave_requests (employee_id) WHERE status = 'pending';

ALTER TABLE public.staff_leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view their own leave requests" ON public.staff_leave_requests
  FOR SELECT TO authenticated USING (auth.uid() = employee_id);
CREATE POLICY "Admins manage leave requests" ON public.staff_leave_requests
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.request_staff_leave(_reason TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_id UUID;
  requester_name TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'employee') THEN RAISE EXCEPTION 'Only staff accounts can request leave.'; END IF;
  IF trim(COALESCE(_reason, '')) = '' THEN RAISE EXCEPTION 'Tell your admin why you need leave.'; END IF;
  IF EXISTS (SELECT 1 FROM public.staff_leave WHERE employee_id = auth.uid() AND ended_at IS NULL) THEN
    RAISE EXCEPTION 'You are already on leave.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.staff_leave_requests WHERE employee_id = auth.uid() AND status = 'pending') THEN
    RAISE EXCEPTION 'You already have a leave request waiting for a decision.';
  END IF;

  INSERT INTO public.staff_leave_requests (employee_id, reason) VALUES (auth.uid(), trim(_reason))
  RETURNING id INTO new_id;

  SELECT COALESCE(full_name, email, 'A staff member') INTO requester_name FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT user_id, 'Leave request from ' || requester_name, requester_name || ' requested leave: ' || trim(_reason), 'leave_request'
  FROM public.user_roles WHERE role = 'admin';

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_staff_leave_request(_request_id UUID, _covering_employee_id UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  request_row public.staff_leave_requests;
  new_leave_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can approve leave requests.'; END IF;
  SELECT * INTO request_row FROM public.staff_leave_requests WHERE id = _request_id AND status = 'pending' FOR UPDATE;
  IF request_row.id IS NULL THEN RAISE EXCEPTION 'This request has already been decided.'; END IF;

  new_leave_id := public.start_staff_leave(request_row.employee_id, request_row.reason, _covering_employee_id);

  UPDATE public.staff_leave_requests
  SET status = 'approved', decided_at = now(), decided_by = auth.uid(), resulting_leave_id = new_leave_id
  WHERE id = _request_id;

  RETURN new_leave_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_staff_leave_request(_request_id UUID, _decision_notes TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE request_row public.staff_leave_requests;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can decline leave requests.'; END IF;
  SELECT * INTO request_row FROM public.staff_leave_requests WHERE id = _request_id AND status = 'pending' FOR UPDATE;
  IF request_row.id IS NULL THEN RAISE EXCEPTION 'This request has already been decided.'; END IF;

  UPDATE public.staff_leave_requests
  SET status = 'declined', decided_at = now(), decided_by = auth.uid(), decision_notes = NULLIF(trim(COALESCE(_decision_notes, '')), '')
  WHERE id = _request_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (request_row.employee_id, 'Leave request declined',
    'Your leave request was declined.' || CASE WHEN NULLIF(trim(COALESCE(_decision_notes, '')), '') IS NOT NULL THEN ' ' || _decision_notes ELSE '' END,
    'leave_request');
END;
$$;

REVOKE ALL ON FUNCTION public.request_staff_leave(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_staff_leave_request(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decline_staff_leave_request(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_staff_leave(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_staff_leave_request(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_staff_leave_request(UUID, TEXT) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_leave_requests;
