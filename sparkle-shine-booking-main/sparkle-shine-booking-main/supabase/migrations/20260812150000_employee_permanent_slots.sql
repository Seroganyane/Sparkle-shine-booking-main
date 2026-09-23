-- Employee permanent slot assignment
CREATE TABLE public.employee_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_number INT NOT NULL CHECK (slot_number >= 1 AND slot_number <= 10),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(slot_number)
);

ALTER TABLE public.employee_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees view own slot" ON public.employee_slots FOR SELECT TO authenticated USING (auth.uid() = employee_id);
CREATE POLICY "Admins view all slots" ON public.employee_slots FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage slots" ON public.employee_slots FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Function to auto-assign a slot to an employee
CREATE OR REPLACE FUNCTION public.auto_assign_employee_slot(_employee_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _available_slot INT;
BEGIN
  -- Check if employee already has a slot
  IF EXISTS (SELECT 1 FROM public.employee_slots WHERE employee_id = _employee_id) THEN
    SELECT slot_number INTO _available_slot FROM public.employee_slots WHERE employee_id = _employee_id;
    RETURN _available_slot;
  END IF;

  -- Find the first available slot (1-10)
  SELECT slot_number INTO _available_slot FROM (
    SELECT generate_series(1, 10) AS slot_number
  ) slots
  WHERE NOT EXISTS (
    SELECT 1 FROM public.employee_slots WHERE slot_number = slots.slot_number
  )
  LIMIT 1;

  -- If no slot available, raise error
  IF _available_slot IS NULL THEN
    RAISE EXCEPTION 'No available slots for employee assignment';
  END IF;

  -- Insert the slot assignment
  INSERT INTO public.employee_slots (employee_id, slot_number)
  VALUES (_employee_id, _available_slot)
  ON CONFLICT DO NOTHING;

  RETURN _available_slot;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_assign_employee_slot(UUID) TO authenticated;
