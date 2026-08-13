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
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const payload = await req.json();
    const { email, password, name, surname, phone, idNumber, userId } = payload ?? {};

    if (!email || !password || !name || !surname || !phone || !idNumber) {
      return new Response(JSON.stringify({ error: 'Missing required signup fields.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const finalUserId = userId || crypto.randomUUID();
    const fullName = `${name} ${surname}`.trim();

    if (!userId) {
      const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: { full_name: fullName, surname, phone, id_number: idNumber },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!createData.user?.id) {
        return new Response(JSON.stringify({ error: 'Failed to create staff account.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const targetUserId = userId || finalUserId;

    const { error: profileError } = await adminClient.from('profiles').upsert({
      id: targetUserId,
      full_name: fullName,
      surname,
      email,
      phone,
      id_number: idNumber,
    }, { onConflict: 'id' });

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: roleError } = await adminClient.from('user_roles').upsert(
      { user_id: targetUserId, role: 'employee' },
      { onConflict: 'user_id,role' }
    );

    if (roleError) {
      return new Response(JSON.stringify({ error: roleError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, userId: targetUserId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Something went wrong' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
