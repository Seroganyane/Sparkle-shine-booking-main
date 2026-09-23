-- Bug: profiles.id_number has a plain UNIQUE constraint, but handle_new_user()
-- wrote an empty string ('') rather than NULL whenever a new auth user's
-- metadata had no id_number — which is every ordinary customer signup and
-- every admin staff invitation (the ID number is only added later, when the
-- invitation is accepted). Postgres treats two empty strings as duplicates
-- (unlike NULL, which is never equal to anything), so the very first such
-- signup succeeded and silently occupied '' — every signup or invite after
-- that hit "duplicate key value violates unique constraint
-- profiles_id_number_key", surfaced to the admin as "Database error saving
-- new user". Confirmed live: exactly one profile already held id_number = ''.
--
-- Fix: store NULL instead of '' (matching the pattern already used for
-- username), and change the unique constraint to a partial index that also
-- excludes blanks, so no future code path can reintroduce this collision.

-- 1. Normalize the one existing row that already tripped this.
UPDATE public.profiles SET id_number = NULL WHERE id_number = '';

-- 2. Drop the plain UNIQUE constraint and its backing index...
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_number_key;

-- 3. ...and replace it with a partial unique index that ignores blanks too.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_id_number_key
  ON public.profiles (id_number)
  WHERE id_number IS NOT NULL AND id_number <> '';

-- 4. Stop writing '' in the first place, and don't let a later blank
--    overwrite an id_number a customer/employee already has on file.
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
    NULLIF(NEW.raw_user_meta_data->>'id_number', ''),
    NULLIF(lower(NEW.raw_user_meta_data->>'username'), '')
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      surname = EXCLUDED.surname,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      id_number = COALESCE(EXCLUDED.id_number, public.profiles.id_number),
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
