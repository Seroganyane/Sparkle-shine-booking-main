-- Automatically enqueue paid or free bookings and notify users when their car is ready and when the wash completes.

CREATE OR REPLACE FUNCTION public.auto_queue_paid_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_pos INT;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.payment_status IN ('paid', 'free'))
     OR (TG_OP = 'UPDATE' AND NEW.payment_status IN ('paid', 'free') AND OLD.payment_status IS DISTINCT FROM NEW.payment_status)
  THEN
    IF NEW.queue_position IS NULL THEN
      SELECT COALESCE(MAX(queue_position), 0) + 1 INTO next_pos
      FROM public.bookings
      WHERE status IN ('in_queue', 'in_progress');
      NEW.queue_position := next_pos;
    END IF;

    IF NEW.status NOT IN ('in_queue', 'in_progress', 'completed', 'cancelled') THEN
      NEW.status := 'in_queue';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_auto_queue
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.auto_queue_paid_booking();

CREATE OR REPLACE FUNCTION public.notify_booking_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.payment_status IN ('paid', 'free'))
     OR (TG_OP = 'UPDATE' AND NEW.payment_status IN ('paid', 'free') AND OLD.payment_status IS DISTINCT FROM NEW.payment_status)
  THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.user_id,
      'Your car is ready to be washed',
      'Your slot is paid and reserved. Your car is now in the queue and will be washed soon.',
      'booking'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_notify_ready
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_booking_ready();

CREATE OR REPLACE FUNCTION public.notify_booking_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.user_id,
      'Wash completed',
      'Your car wash is complete. Thank you for choosing Sparkle Shine!',
      'booking'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_notify_completed
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_booking_completed();
