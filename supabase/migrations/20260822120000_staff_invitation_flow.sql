-- Store the primary application role on the public user profile.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'user';

UPDATE public.profiles AS profile
SET role = CASE
  WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = profile.id AND r.role = 'admin') THEN 'admin'::public.app_role
  WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = profile.id AND r.role = 'employee') THEN 'employee'::public.app_role
  ELSE 'user'::public.app_role
END;

CREATE TABLE public.staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  first_name text NOT NULL,
  surname text NOT NULL,
  phone text NOT NULL,
  id_number text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  invited_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX staff_invitations_one_active_email
  ON public.staff_invitations (lower(email))
  WHERE used_at IS NULL;

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view staff invitations"
  ON public.staff_invitations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.consume_staff_invitation(
  _invitation_id uuid,
  _code_hash text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation public.staff_invitations%ROWTYPE;
  assigned_slot integer;
BEGIN
  SELECT * INTO invitation
  FROM public.staff_invitations
  WHERE id = _invitation_id
  FOR UPDATE;

  IF invitation.id IS NULL
    OR invitation.used_at IS NOT NULL
    OR invitation.expires_at <= now()
    OR invitation.code_hash <> _code_hash
    OR invitation.invited_user_id <> auth.uid()
    OR lower(invitation.email) <> lower(COALESCE(auth.jwt() ->> 'email', '')) THEN
    RAISE EXCEPTION 'This staff invitation is invalid, expired, or already used.';
  END IF;

  UPDATE public.staff_invitations SET used_at = now() WHERE id = invitation.id;

  DELETE FROM public.user_roles WHERE user_id = auth.uid() AND role = 'user';
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'employee')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.profiles
  SET full_name = trim(invitation.first_name || ' ' || invitation.surname),
      surname = invitation.surname,
      email = invitation.email,
      phone = invitation.phone,
      id_number = invitation.id_number,
      role = 'employee',
      updated_at = now()
  WHERE id = auth.uid();

  assigned_slot := public.auto_assign_employee_slot(auth.uid());
  UPDATE public.profiles SET assigned_slot_number = assigned_slot WHERE id = auth.uid();
  RETURN assigned_slot;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_staff_invitation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_staff_invitation(uuid, text) TO authenticated;
