CREATE OR REPLACE FUNCTION public.sync_profile_role_from_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid := COALESCE(NEW.user_id, OLD.user_id);
BEGIN
  UPDATE public.profiles
  SET role = CASE
    WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = target_user_id AND r.role = 'admin') THEN 'admin'::public.app_role
    WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = target_user_id AND r.role = 'employee') THEN 'employee'::public.app_role
    ELSE 'user'::public.app_role
  END,
  updated_at = now()
  WHERE id = target_user_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_role_after_role_change ON public.user_roles;
CREATE TRIGGER sync_profile_role_after_role_change
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role_from_user_roles();
