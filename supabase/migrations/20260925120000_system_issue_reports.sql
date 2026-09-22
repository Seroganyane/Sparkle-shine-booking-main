-- Lets an admin report a system-wide problem (not tied to one booking or
-- customer) so it reaches the system administrator — every other admin
-- account, the same way every other cross-admin alert in this app works —
-- instead of getting lost in a chat message or forgotten.
CREATE TYPE public.system_report_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.system_report_status AS ENUM ('open', 'resolved');

CREATE TABLE public.system_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity public.system_report_severity NOT NULL DEFAULT 'medium',
  status public.system_report_status NOT NULL DEFAULT 'open',
  reported_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT
);

ALTER TABLE public.system_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage system reports" ON public.system_reports
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.report_system_issue(_title TEXT, _description TEXT, _severity public.system_report_severity DEFAULT 'medium')
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_id UUID;
  reporter_name TEXT;
  other_admins INT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can report system issues.'; END IF;
  IF trim(COALESCE(_title, '')) = '' THEN RAISE EXCEPTION 'Give the problem a short title.'; END IF;
  IF trim(COALESCE(_description, '')) = '' THEN RAISE EXCEPTION 'Describe what is going wrong.'; END IF;

  INSERT INTO public.system_reports (title, description, severity, reported_by)
  VALUES (trim(_title), trim(_description), COALESCE(_severity, 'medium'), auth.uid())
  RETURNING id INTO new_id;

  SELECT COALESCE(full_name, email, 'An admin') INTO reporter_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT user_id, '⚠️ System issue: ' || trim(_title),
    reporter_name || ' reported a ' || COALESCE(_severity, 'medium') || '-severity system problem: ' || trim(_description),
    'system_report'
  FROM public.user_roles WHERE role = 'admin' AND user_id <> auth.uid();

  -- If the reporter is currently the only admin account, log it back to them
  -- so it's confirmed as recorded rather than silently going nowhere.
  SELECT count(*) INTO other_admins FROM public.user_roles WHERE role = 'admin' AND user_id <> auth.uid();
  IF other_admins = 0 THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (auth.uid(), 'System issue logged: ' || trim(_title), 'Recorded. You are currently the only admin account, so add a second admin if this needs to reach someone else.', 'system_report');
  END IF;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_system_report(_report_id UUID, _resolution_notes TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can resolve system reports.'; END IF;
  UPDATE public.system_reports
  SET status = 'resolved', resolved_at = now(), resolved_by = auth.uid(), resolution_notes = NULLIF(trim(COALESCE(_resolution_notes, '')), '')
  WHERE id = _report_id AND status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'This report is not open.'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.report_system_issue(TEXT, TEXT, public.system_report_severity) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_system_report(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_system_issue(TEXT, TEXT, public.system_report_severity) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_system_report(UUID, TEXT) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.system_reports;
