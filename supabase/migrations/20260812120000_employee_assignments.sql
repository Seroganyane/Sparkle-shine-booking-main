-- Employee work allocation and supervisor availability alerts.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'employee';

CREATE TYPE public.employee_assignment_status AS ENUM ('active', 'completed');

CREATE TABLE public.employee_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id),
  status public.employee_assignment_status NOT NULL DEFAULT 'active',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX one_active_assignment_per_booking ON public.employee_assignments (booking_id) WHERE status = 'active';
CREATE UNIQUE INDEX one_active_assignment_per_employee ON public.employee_assignments (employee_id) WHERE status = 'active';
ALTER TABLE public.employee_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees view own assignments" ON public.employee_assignments FOR SELECT TO authenticated USING (auth.uid() = employee_id);
CREATE POLICY "Admins manage employee assignments" ON public.employee_assignments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.complete_employee_assignment(_assignment_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE assignment_row public.employee_assignments; employee_name TEXT;
BEGIN
  SELECT * INTO assignment_row FROM public.employee_assignments
  WHERE id = _assignment_id AND employee_id = auth.uid() AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active assignment not found'; END IF;
  UPDATE public.employee_assignments SET status = 'completed', completed_at = now() WHERE id = _assignment_id;
  UPDATE public.bookings SET status = 'completed' WHERE id = assignment_row.booking_id;
  SELECT COALESCE(full_name, 'An employee') INTO employee_name FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT user_id, 'Employee available', employee_name || ' finished a wash and is ready for the next car.', 'employee_availability'
  FROM public.user_roles WHERE role = 'admin';
END;
$$;
GRANT EXECUTE ON FUNCTION public.complete_employee_assignment(UUID) TO authenticated;
