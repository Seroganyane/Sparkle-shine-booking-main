-- South African identity numbers: 13 digits = YYMMDD, SSSS, C (0/1), A, Luhn check digit.
-- Mirrors src/lib/idNumber.ts and the admin-create-user edge function.
CREATE OR REPLACE FUNCTION public.is_valid_sa_id_number(_id text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  yy integer;
  mm integer;
  dd integer;
  digit integer;
  total integer := 0;
  century integer;
  birth date;
  real_date boolean := false;
BEGIN
  IF _id IS NULL OR _id !~ '^[0-9]{13}$' THEN
    RETURN false;
  END IF;

  yy := substr(_id, 1, 2)::integer;
  mm := substr(_id, 3, 2)::integer;
  dd := substr(_id, 5, 2)::integer;
  IF mm < 1 OR mm > 12 OR dd < 1 OR dd > 31 THEN
    RETURN false;
  END IF;

  -- The two-digit year is ambiguous: the date must exist in one century and not be in the future.
  FOREACH century IN ARRAY ARRAY[1900, 2000] LOOP
    BEGIN
      birth := make_date(century + yy, mm, dd);
      IF birth <= current_date THEN real_date := true; END IF;
    EXCEPTION WHEN others THEN
      NULL; -- e.g. 29 Feb in a non-leap year
    END;
  END LOOP;
  IF NOT real_date THEN
    RETURN false;
  END IF;

  IF substr(_id, 11, 1) NOT IN ('0', '1') THEN
    RETURN false;
  END IF;

  FOR i IN 0..12 LOOP
    digit := substr(_id, 13 - i, 1)::integer;
    IF i % 2 = 1 THEN
      digit := digit * 2;
      IF digit > 9 THEN digit := digit - 9; END IF;
    END IF;
    total := total + digit;
  END LOOP;

  RETURN total % 10 = 0;
END;
$$;

-- NOT VALID enforces the rule for every new or updated invitation without failing
-- the migration on rows created before validation existed. Once those rows are
-- corrected or removed, run: ALTER TABLE public.staff_invitations
--   VALIDATE CONSTRAINT staff_invitations_id_number_valid;
ALTER TABLE public.staff_invitations
  ADD CONSTRAINT staff_invitations_id_number_valid
  CHECK (public.is_valid_sa_id_number(id_number)) NOT VALID;
