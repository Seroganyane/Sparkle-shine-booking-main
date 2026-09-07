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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'Authorization is required.' }, 401);
    const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: 'Invalid session.' }, 401);
    const { data: adminRole } = await adminClient.from('user_roles').select('user_id').eq('user_id', caller.id).eq('role', 'admin').maybeSingle();
    if (!adminRole) return json({ error: 'Only admins can invite staff.' }, 403);

    const { email, firstName, surname, phone, idNumber, registrationUrl } = await req.json();
    if (!email || !firstName || !surname || !phone || !idNumber || !registrationUrl) return json({ error: 'Missing invitation fields.' }, 400);
    const normalizedEmail = String(email).trim().toLowerCase();
    // A newly issued invitation invalidates every earlier code for this email.
    await adminClient.from('staff_invitations').update({ used_at: new Date().toISOString() }).eq('email', normalizedEmail).is('used_at', null);

    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
    const { data: invitation, error: invitationError } = await adminClient.from('staff_invitations').insert({
      email: normalizedEmail,
      code_hash: await sha256(code),
      first_name: String(firstName).trim(), surname: String(surname).trim(), phone: String(phone).trim(), id_number: String(idNumber).trim(), invited_by: caller.id,
    }).select('id, expires_at').single();
    if (invitationError) return json({ error: invitationError.code === '23505' ? 'This email already has an active staff invitation.' : invitationError.message }, 400);

    const redirect = new URL(registrationUrl);
    redirect.searchParams.set('invitation', invitation.id);
    redirect.searchParams.set('code', code);
    const { data: usersData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingUser = usersData.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    let invitedUserId: string;
    if (existingUser) {
      invitedUserId = existingUser.id;
      const { error: recoveryError } = await adminClient.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: redirect.toString() });
      if (recoveryError) {
        await adminClient.from('staff_invitations').delete().eq('id', invitation.id);
        return json({ error: recoveryError.message }, 400);
      }
    } else {
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
        redirectTo: redirect.toString(), data: { staff_invitation_id: invitation.id, staff_invitation_code: code },
      });
      if (inviteError || !inviteData.user) {
        await adminClient.from('staff_invitations').delete().eq('id', invitation.id);
        return json({ error: inviteError?.message || 'Could not send the invitation email.' }, 400);
      }
      invitedUserId = inviteData.user.id;
    }
    await adminClient.from('staff_invitations').update({ invited_user_id: invitedUserId }).eq('id', invitation.id);
    return json({ invitationId: invitation.id, code, expiresAt: invitation.expires_at });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not create staff invitation.' }, 500);
  }
});
