-- 1. Employees could read their assignment row but not the booking it points to,
--    so the embedded booking always came back empty. Let them read only the
--    bookings that are (or were) assigned to them.
DROP POLICY IF EXISTS "Employees view assigned bookings" ON public.bookings;
CREATE POLICY "Employees view assigned bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.employee_assignments a
    WHERE a.booking_id = bookings.id AND a.employee_id = auth.uid()
  ));

-- 2. Tell the employee when a booking is assigned to them.
CREATE OR REPLACE FUNCTION public.notify_employee_of_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE booking_row public.bookings;
BEGIN
  SELECT * INTO booking_row FROM public.bookings WHERE id = NEW.booking_id;
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    NEW.employee_id,
    'New booking assigned',
    'You have been assigned a ' || COALESCE(booking_row.car_make, '') || ' ' || COALESCE(booking_row.car_model, '') ||
      ' (' || COALESCE(booking_row.car_plate, '') || ')' ||
      CASE WHEN booking_row.slot_number IS NOT NULL THEN ' at Wash Bay #' || booking_row.slot_number ELSE '' END ||
      '. Open your workspace to accept it.',
    'booking_assigned'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employee_assignments_notify ON public.employee_assignments;
CREATE TRIGGER employee_assignments_notify
  AFTER INSERT ON public.employee_assignments
  FOR EACH ROW EXECUTE FUNCTION public.notify_employee_of_assignment();

-- 3. The realtime publication was empty, so no live change (new notification,
--    new assignment, booking update) ever reached any signed-in client.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bookings', 'employee_assignments', 'notifications', 'profiles'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$$;
