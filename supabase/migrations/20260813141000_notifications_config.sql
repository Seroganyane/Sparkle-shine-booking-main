-- Add SMS/Email notification preferences and tracking
CREATE TABLE IF NOT EXISTS public.notifications_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  send_email_notifications BOOLEAN DEFAULT TRUE,
  send_sms_notifications BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.notifications_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notification config" ON public.notifications_config
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Track sent notifications
CREATE TABLE IF NOT EXISTS public.sent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  channel TEXT NOT NULL,
  title TEXT,
  message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL
);

ALTER TABLE public.sent_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own sent notifications" ON public.sent_notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
