import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

// Mirrors src/lib/idNumber.ts — a South African ID is 13 digits: YYMMDD, gender
// sequence, citizenship digit, and a Luhn check digit. Never trust the client copy.
const idNumberError = (value: string) => {
  const id = String(value).replace(/\s/g, '');
  if (!/^\d{13}$/.test(id)) return 'Identity number must be exactly 13 digits.';
  const month = Number(id.slice(2, 4));
  const day = Number(id.slice(4, 6));
  const realDate = month >= 1 && month <= 12 && day >= 1 && day <= 31 && [1900, 2000].some((century) => {
    const date = new Date(Date.UTC(century + Number(id.slice(0, 2)), month - 1, day));
    return date.getUTCMonth() === month - 1 && date.getUTCDate() === day && date.getTime() <= Date.now();
  });
  if (!realDate) return 'The first six digits of the identity number must be a date of birth (YYMMDD).';
  if (id[10] !== '0' && id[10] !== '1') return 'The eleventh digit of the identity number must be 0 or 1.';
  let sum = 0;
  for (let offset = 0; offset < id.length; offset++) {
    let digit = Number(id[id.length - 1 - offset]);
    if (offset % 2 === 1) digit = digit * 2 > 9 ? digit * 2 - 9 : digit * 2;
    sum += digit;
  }
  if (sum % 10 !== 0) return 'This identity number is not valid — please check it for typos.';
  return null;
};

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
    const invalidIdNumber = idNumberError(idNumber);
    if (invalidIdNumber) return json({ error: invalidIdNumber }, 400);
    const normalizedIdNumber = String(idNumber).replace(/\s/g, '');
    const normalizedEmail = String(email).trim().toLowerCase();
    // A newly issued invitation invalidates every earlier code for this email.
    await adminClient.from('staff_invitations').update({ used_at: new Date().toISOString() }).eq('email', normalizedEmail).is('used_at', null);

    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
    const { data: invitation, error: invitationError } = await adminClient.from('staff_invitations').insert({
      email: normalizedEmail,
      code_hash: await sha256(code),
      first_name: String(firstName).trim(), surname: String(surname).trim(), phone: String(phone).trim(), id_number: normalizedIdNumber, invited_by: caller.id,
    }).select('id, expires_at').single();
    if (invitationError) return json({ error: invitationError.code === '23505' ? 'This email already has an active staff invitation.' : invitationError.message }, 400);

    const redirect = new URL(registrationUrl);
    redirect.searchParams.set('invitation', invitation.id);
    redirect.searchParams.set('code', code);
    const { data: usersData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingUser = usersData.users.find((user) => user.email?.toLowerCase() === normalizedEmail);

    if (existingUser) {
      const isPendingStaffInvite = !existingUser.email_confirmed_at && Boolean(existingUser.user_metadata?.staff_invitation_id);
      if (!isPendingStaffInvite) {
        await adminClient.from('staff_invitations').delete().eq('id', invitation.id);
        return json({
          error: 'This email already has an account. Add that account as an employee from the Employees list instead of sending an invitation.',
        }, 409);
      }

      // Supabase cannot invite an address that already has an Auth user. A previous,
      // unaccepted staff invite is safe to replace; confirmed accounts are never deleted.
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(existingUser.id);
      if (deleteError) {
        await adminClient.from('staff_invitations').delete().eq('id', invitation.id);
        return json({ error: `Could not replace the previous invitation: ${deleteError.message}` }, 400);
      }
    }

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo: redirect.toString(),
      data: {
        staff_invitation_id: invitation.id,
        staff_invitation_code: code,
        first_name: String(firstName).trim(),
        surname: String(surname).trim(),
        invitation_expires_at: invitation.expires_at,
      },
    });
    if (inviteError || !inviteData.user) {
      await adminClient.from('staff_invitations').delete().eq('id', invitation.id);
      return json({ error: inviteError?.message || 'Could not send the invitation email.' }, 400);
    }
    const invitedUserId = inviteData.user.id;
    await adminClient.from('staff_invitations').update({ invited_user_id: invitedUserId }).eq('id', invitation.id);
    return json({ invitationId: invitation.id, code, expiresAt: invitation.expires_at });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not create staff invitation.' }, 500);
  }
});
