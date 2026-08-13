-- Add employee-specific fields to profiles for admin registration
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS surname TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS id_number TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_slot_number INT REFERENCES public.employee_slots(slot_number) ON DELETE SET NULL;

-- Create or replace function to register employee with auto-slot assignment
CREATE OR REPLACE FUNCTION public.register_employee_with_slot(
  _email TEXT,
  _full_name TEXT,
  _surname TEXT,
  _phone TEXT,
  _id_number TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id UUID;
  existing_user_id UUID;
  slot_num INT;
  result JSONB;
BEGIN
  -- Check if admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can register employees';
  END IF;

  -- Check if user already exists
  SELECT id INTO existing_user_id FROM auth.users WHERE email = _email;
  IF existing_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Email already registered';
  END IF;

  -- Create user in auth
  INSERT INTO auth.users (email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (
    _email,
    now(),
    '{"provider":"email"}',
    '{}',
    now(),
    now()
  )
  RETURNING id INTO new_user_id;

  -- Create profile
  INSERT INTO public.profiles (id, full_name, surname, email, phone, id_number)
  VALUES (new_user_id, _full_name, _surname, _email, _phone, _id_number);

  -- Assign employee role
  INSERT INTO public.user_roles (user_id, role) VALUES (new_user_id, 'employee');

  -- Auto-assign slot
  SELECT slot_number INTO slot_num FROM public.employee_slots
  WHERE employee_id IS NULL ORDER BY slot_number LIMIT 1;

  IF slot_num IS NOT NULL THEN
    UPDATE public.employee_slots SET employee_id = new_user_id WHERE slot_number = slot_num;
    UPDATE public.profiles SET assigned_slot_number = slot_num WHERE id = new_user_id;
  END IF;

  RETURN jsonb_build_object(
    'user_id', new_user_id,
    'email', _email,
    'slot_number', slot_num
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_employee_with_slot(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Update employee_slots to track assignment
ALTER TABLE public.employee_slots ADD COLUMN IF NOT EXISTS employee_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;
