import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export function userClient(req: Request): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const auth = req.headers.get('Authorization') ?? '';
  return createClient(url, anon, { global: { headers: { Authorization: auth } } });
}

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key, { auth: { persistSession: false } });
}
