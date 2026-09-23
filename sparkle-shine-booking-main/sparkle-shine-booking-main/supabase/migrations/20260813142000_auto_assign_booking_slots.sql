-- Auto-assign wash bay slots to bookings based on available employee slots
CREATE OR REPLACE FUNCTION public.auto_assign_booking_slot(_booking_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_slot INT;
BEGIN
  -- Find first available slot that has an assigned employee
  SELECT slot_number INTO assigned_slot
  FROM public.employee_slots
  WHERE employee_id IS NOT NULL
    AND slot_number NOT IN (
      SELECT DISTINCT slot_number FROM public.bookings 
      WHERE status NOT IN ('completed', 'cancelled') 
      AND slot_number IS NOT NULL
    )
  ORDER BY slot_number ASC
  LIMIT 1;

  -- If no slot available, use round-robin from 1-10
  IF assigned_slot IS NULL THEN
    SELECT COALESCE(MAX(slot_number), 0) + 1 INTO assigned_slot
    FROM public.bookings
    WHERE status NOT IN ('completed', 'cancelled');
    
    IF assigned_slot > 10 THEN
      assigned_slot := 1;
    END IF;
  END IF;

  -- Assign slot to booking
  UPDATE public.bookings SET slot_number = assigned_slot WHERE id = _booking_id;
  
  RETURN assigned_slot;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_assign_booking_slot(UUID) TO authenticated;

-- Create trigger to auto-assign slots when bookings are created
CREATE OR REPLACE FUNCTION public.trigger_auto_assign_booking_slot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.slot_number IS NULL THEN
    PERFORM public.auto_assign_booking_slot(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_assign_slot_on_booking_create ON public.bookings;
CREATE TRIGGER auto_assign_slot_on_booking_create
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_assign_booking_slot();
