// check-db.mjs — valida a conexão com o Supabase e a presença das tabelas que a
// plataforma usa. Lê credenciais de process.env; se faltarem, tenta o ../.env do
// backend (mesmo projeto). Uso: node scripts/check-db.mjs
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvFallback() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) return;
  for (const f of ['.env.local', '../.env']) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

loadEnvFallback();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY ausentes.');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const tables = ['pending_approvals', 'scheduled_posts', 'publish_slots', 'posts'];

console.log(`🔌 ${url}`);
let allOk = true;
for (const t of tables) {
  // count exact dá o total real; limit(1) evita puxar tudo; o select sem head
  // ainda expõe "table not found" no campo error.
  const { count, error } = await db.from(t).select('*', { count: 'exact' }).limit(1);
  if (error) {
    allOk = false;
    console.log(`  ❌ ${t.padEnd(20)} ${error.message}`);
  } else {
    console.log(`  ✅ ${t.padEnd(20)} ${count ?? 0} linha(s)`);
  }
}

if (!allOk) {
  console.log('\n⚠️  Tabela faltando? Aplique supabase/migrations/0002_platform_scheduling.sql no SQL Editor.');
  process.exit(2);
}
console.log('\n✅ Banco acessível e schema pronto.');
