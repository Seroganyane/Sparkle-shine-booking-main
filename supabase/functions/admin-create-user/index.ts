import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return new Response(JSON.stringify({ error: 'Authorization is required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: adminRole } = await adminClient.from('user_roles').select('user_id').eq('user_id', caller.id).eq('role', 'admin').maybeSingle();
    if (!adminRole) {
      return new Response(JSON.stringify({ error: 'Only admins can register employees' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { email, firstName, surname, phone, idNumber } = await req.json();
    if (!email || !firstName || !surname || !phone || !idNumber) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const password = Math.random().toString(36).slice(-12);
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
    if (authError) return new Response(JSON.stringify({ error: authError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const userId = authData.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: 'Failed to create user' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { error: profileError } = await adminClient.from('profiles').upsert({ id: userId, full_name: `${firstName} ${surname}`, surname, email, phone, id_number: idNumber }, { onConflict: 'id' });
    if (profileError) return new Response(JSON.stringify({ error: profileError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { error: roleError } = await adminClient.from('user_roles').insert({ user_id: userId, role: 'employee' });
    if (roleError) return new Response(JSON.stringify({ error: roleError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: assignedSlot, error: slotError } = await adminClient.rpc('auto_assign_employee_slot', { _employee_id: userId });
    if (slotError) return new Response(JSON.stringify({ error: slotError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { error: slotProfileError } = await adminClient
      .from('profiles')
      .update({ assigned_slot_number: assignedSlot })
      .eq('id', userId);
    if (slotProfileError) return new Response(JSON.stringify({ error: slotProfileError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    await adminClient.from('notifications').insert({ user_id: userId, title: 'Welcome to AquaLux Staff Portal!', message: `Hi ${firstName}, your staff account has been created. Use this email (${email}) to login.`, type: 'admin_alert' });
    return new Response(JSON.stringify({ userId, assigned_slot: assignedSlot }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});