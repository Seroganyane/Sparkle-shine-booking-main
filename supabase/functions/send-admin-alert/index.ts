// Sends a real email to the system administrator when something is wrong
// with the app — a reported system problem, or an automatically-detected
// crash. Kept separate from the in-app "system_reports" notification flow
// (see report_system_issue) so it can also fire for visitors who aren't
// signed in as an admin, e.g. a customer hitting an uncaught error.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

// Fixed recipient per the site owner's request. Overridable via the
// SYSTEM_ADMIN_EMAIL secret if that ever needs to change without a redeploy.
const SYSTEM_ADMIN_EMAIL = Deno.env.get('SYSTEM_ADMIN_EMAIL') || 'seroganyanemathaba@gmail.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    // The gateway already requires a valid Supabase API key to reach this
    // function at all; we don't additionally gate on a signed-in session,
    // since an uncaught error on a public page should still be able to
    // alert the admin even if nobody is logged in yet.
    const { subject, message, severity } = await req.json();
    if (!subject || !message) return json({ error: 'A subject and message are required.' }, 400);

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.error('RESEND_API_KEY is not set — cannot send the system alert email.');
      return json({ error: 'Email alerts are not configured yet. Set the RESEND_API_KEY secret.' }, 501);
    }

    const safeSubject = String(subject).trim().slice(0, 200);
    const safeMessage = String(message).trim().slice(0, 2000);
    const safeSeverity = severity ? String(severity).trim().slice(0, 20) : undefined;

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'AquaLux System Alerts <onboarding@resend.dev>',
        to: [SYSTEM_ADMIN_EMAIL],
        subject: `[AquaLux${safeSeverity ? ` · ${safeSeverity.toUpperCase()}` : ''}] ${safeSubject}`,
        html: `<p>${safeMessage.replace(/\n/g, '<br>')}</p><p style="color:#888;font-size:12px">Sent automatically by the AquaLux system.</p>`,
      }),
    });

    if (!emailResponse.ok) {
      const errorBody = await emailResponse.text();
      console.error('Resend API error:', emailResponse.status, errorBody);
      return json({ error: 'Could not send the alert email.' }, 502);
    }

    return json({ ok: true });
  } catch (error) {
    console.error('send-admin-alert failed:', error);
    return json({ error: error instanceof Error ? error.message : 'Could not send the alert email.' }, 500);
  }
});
