// apply-migration.mjs — aplica a migration de agendamento no projeto pessoal e
// valida. Requer SUPABASE_DB_URL (Dashboard → Project Settings → Database →
// Connection string → URI). Lê de process.env, .env.local ou ../.env.
// Uso: node scripts/apply-migration.mjs
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

function loadEnv() {
  for (const f of ['.env.local', '../.env']) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadEnv();

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error(
    '❌ SUPABASE_DB_URL ausente.\n' +
      '   Pegue em: Dashboard → Project Settings → Database → Connection string → URI (porta 5432, com a senha)\n' +
      '   e adicione no .env da raiz: SUPABASE_DB_URL=postgresql://postgres:[SENHA]@db.<ref>.supabase.co:5432/postgres',
  );
  process.exit(1);
}

const migration = '../supabase/migrations/0002_platform_scheduling.sql';
console.log('📦 Aplicando 0002_platform_scheduling.sql…');
try {
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', dbUrl, '-f', migration], { stdio: 'inherit' });
  console.log('✅ Migration aplicada.');
} catch (e) {
  console.error('❌ Falha ao aplicar via psql:', e.message);
  process.exit(2);
}

console.log('\n🔎 Validando…');
execFileSync('node', ['scripts/check-db.mjs'], { stdio: 'inherit' });
