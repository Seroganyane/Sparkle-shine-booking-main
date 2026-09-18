import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);

  try {
    const { username, password } = await request.json();
    if (typeof username !== 'string' || !/^[a-z0-9_]{3,30}$/i.test(username) || typeof password !== 'string' || !password) {
      return reply({ error: 'Invalid username or password.' }, 401);
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: profile, error: lookupError } = await admin.from('profiles')
      .select('email').eq('username', username.toLowerCase()).maybeSingle();
    if (lookupError) return reply({ error: 'Sign-in is temporarily unavailable.' }, 503);
    if (!profile?.email) return reply({ error: 'Invalid username or password.' }, 401);

    const auth = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email: profile.email, password });
    if (error || !data.session) return reply({ error: 'Invalid username or password.' }, 401);

    return reply({ accessToken: data.session.access_token, refreshToken: data.session.refresh_token });
  } catch {
    return reply({ error: 'Unable to sign in right now.' }, 500);
  }
});
