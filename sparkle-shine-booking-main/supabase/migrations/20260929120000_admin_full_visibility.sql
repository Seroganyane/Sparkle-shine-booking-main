-- Admins can already read or manage nearly every table in this app, but an
-- audit found three tables with no admin policy at all — meaning even an
-- admin investigating a problem couldn't see this data. Most notably
-- paystack_payments, which is exactly where a payment problem would show up.
-- Read-only for admins here: seeing payment/notification history to
-- troubleshoot is the goal, not letting admins alter financial records.
CREATE POLICY "Admins view all Paystack payments" ON public.paystack_payments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins view all sent notifications" ON public.sent_notifications
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins view all notification config" ON public.notifications_config
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
