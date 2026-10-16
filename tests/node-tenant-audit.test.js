import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { TENANT_TABLES } from '../platform/src/lib/tenant-tables.ts';

// Tabelas com tenant_id (as migrations são a fonte). Toda consulta do Node a elas precisa
// carimbar ou filtrar o tenant, ou agir por chave primária (uuid).
const SRC = join(import.meta.dirname, '../src');
const MIGRATIONS = join(import.meta.dirname, '../supabase/migrations');

function tenantTables() {
  const tables = new Set();
  for (const f of readdirSync(MIGRATIONS)) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
    for (const m of sql.matchAll(/create table if not exists (\w+)\s*\(([\s\S]*?)\n\);/g)) {
      if (/\btenant_id\b/.test(m[2])) tables.add(m[1]);
    }
    for (const m of sql.matchAll(/alter table (\w+)\s+add column if not exists tenant_id/g)) tables.add(m[1]);
  }
  tables.delete('tenants');
  tables.delete('tenant_members');
  return tables;
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.js') ? [join(dir, e.name)] : [],
  );
}

// Trecho da cadeia: do `.from('x')` até o primeiro `;` no fim de linha (ou 25 linhas), mais 12
// linhas antes, onde costumam ser montadas as linhas de um insert em lote.
function chains(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const out = [];
  lines.forEach((line, i) => {
    const m = line.match(/\.from\('(\w+)'\)/);
    if (!m) return;
    let end = i;
    while (end < Math.min(lines.length - 1, i + 25) && !/;\s*$/.test(lines[end])) end += 1;
    out.push({ table: m[1], line: i + 1, text: lines.slice(Math.max(0, i - 12), end + 1).join('\n') });
  });
  return out;
}

const PRIMARY_KEY_ACTION = /\.(eq|in)\('(id|post_id|pending_id)'/;
const TENANT = /tenant_id|tenantId|currentTenantId|tenant\.id/;

// Exceções conscientes, com o motivo. Cada uma é uma dívida visível, não um esquecimento.
const KNOWN = {
  // ainda sem escopo: ver SPEC 006 F2 (pendências do lado Node)
};

describe('Node: toda consulta a tabela de tenant carimba ou filtra o tenant', () => {
  const tables = tenantTables();

  it('descobre as tabelas pelas migrations', () => {
    for (const t of ['posts', 'queue_items', 'pending_approvals', 'scheduled_posts', 'feedback', 'engagements']) {
      expect(tables.has(t)).toBe(true);
    }
  });

  it('a exportação do tenant cobre todas as tabelas com tenant_id', () => {
    expect([...TENANT_TABLES].sort()).toEqual([...tables].sort());
  });

  it('nenhuma consulta fica sem escopo de tenant', () => {
    const offenders = [];
    for (const file of walk(SRC)) {
      for (const c of chains(file)) {
        if (!tables.has(c.table)) continue;
        const writes = /\.(insert|upsert)\(/.test(c.text);
        const ok = TENANT.test(c.text) || (!writes && PRIMARY_KEY_ACTION.test(c.text));
        const key = `${file.replace(SRC + '/', '')}:${c.line} (${c.table})`;
        if (!ok && !KNOWN[key]) offenders.push(key);
      }
    }
    expect(offenders).toEqual([]);
  });
});
