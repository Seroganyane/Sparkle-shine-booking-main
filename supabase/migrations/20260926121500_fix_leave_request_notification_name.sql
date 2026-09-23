-- Bug fix: profiles.full_name is stored as '' (not NULL) when unset (see
-- handle_new_user), so COALESCE(full_name, email, ...) never fell through to
-- email — every leave-request notification read "Leave request from " with
-- no name. Confirmed with a live simulation before this fix.
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

  SELECT COALESCE(NULLIF(full_name, ''), email, 'A staff member') INTO requester_name FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT user_id, 'Leave request from ' || requester_name, requester_name || ' requested leave: ' || trim(_reason), 'leave_request'
  FROM public.user_roles WHERE role = 'admin';

  RETURN new_id;
END;
$$;
