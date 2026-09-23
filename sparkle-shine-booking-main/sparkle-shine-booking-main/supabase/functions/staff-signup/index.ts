import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const sha256 = async (value: string) => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'Open the link in your staff invitation email first.' }, 401);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Your invitation session is invalid or expired.' }, 401);

    const { invitationId, code, password } = await req.json();
    if (!invitationId || !/^\d{6}$/.test(code || '') || !password || password.length < 6) return json({ error: 'Enter the six-digit code and a password of at least six characters.' }, 400);
    const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const codeHash = await sha256(code);
    const { data: invitation } = await adminClient.from('staff_invitations').select('id').eq('id', invitationId)
      .eq('invited_user_id', user.id).eq('code_hash', codeHash).is('used_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (!invitation) return json({ error: 'This staff invitation is invalid, expired, or already used.' }, 400);
    // Consume the invitation atomically before changing credentials. The database
    // row is locked by consume_staff_invitation, so only one simultaneous request
    // can win and a replay can never be used to reset the staff member's password.
    const { data: assignedSlot, error: consumeError } = await userClient.rpc('consume_staff_invitation', { _invitation_id: invitationId, _code_hash: codeHash });
    if (consumeError) return json({ error: consumeError.message }, 400);
    const { error: passwordError } = await adminClient.auth.admin.updateUserById(user.id, { password, email_confirm: true, user_metadata: { ...user.user_metadata, role: 'employee' } });
    if (passwordError) return json({ error: 'The invitation was secured, but the password could not be set. Ask an administrator for a new invitation.' }, 400);
    return json({ ok: true, assignedSlot });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Staff registration failed.' }, 500);
  }
});
