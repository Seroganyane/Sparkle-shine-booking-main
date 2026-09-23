ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,30}$');

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

CREATE OR REPLACE FUNCTION public.username_is_available(candidate text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT candidate ~ '^[a-z0-9_]{3,30}$'
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate);
$$;

GRANT EXECUTE ON FUNCTION public.username_is_available(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, surname, email, phone, id_number, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'surname', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'id_number', ''),
    NULLIF(lower(NEW.raw_user_meta_data->>'username'), '')
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      surname = EXCLUDED.surname,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      id_number = EXCLUDED.id_number,
      username = COALESCE(EXCLUDED.username, public.profiles.username);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'role', 'user')::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF COALESCE(NEW.raw_user_meta_data->>'role', 'user') = 'employee' THEN
    INSERT INTO public.employee_slots (employee_id, slot_number)
    SELECT NEW.id, gs.slot_number
    FROM generate_series(1, 10) AS gs(slot_number)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.employee_slots WHERE slot_number = gs.slot_number
    )
    LIMIT 1
    ON CONFLICT (employee_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
