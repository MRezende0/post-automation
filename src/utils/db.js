// db.js — cliente Supabase (server-side, service_role). Lazy: só conecta quando
// usado. Backend-only (GitHub Actions); a service key faz bypass de RLS.
//
// Cutover gradual: o pipeline só usa o banco quando STATE_BACKEND=supabase.
// Sem a flag, tudo continua em YAML (comportamento atual).

import { createClient } from '@supabase/supabase-js';

let client = null;

export function supabase() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórias para STATE_BACKEND=supabase. Veja .env.example.');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export function usingSupabase() {
  return process.env.STATE_BACKEND === 'supabase';
}
