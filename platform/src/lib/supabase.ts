// Cliente Supabase server-side (service_role). Faz bypass de RLS — por isso
// NUNCA pode rodar no browser. Todo acesso ao DB passa por Server Components /
// Route Handlers / o cron, todos server-only.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórias (server-side).');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
