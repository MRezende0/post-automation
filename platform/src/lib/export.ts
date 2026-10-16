// export.ts: tudo que a plataforma guarda do tenant, em um JSON (LGPD, portabilidade).
// Só lê, só do tenant da sessão. Credenciais de rede não ficam no banco, então não saem aqui.

import type { TenantDb } from './tenant-db';
import { TENANT_TABLES } from './tenant-tables';

const PAGE = 1000;
const MAX_ROWS_PER_TABLE = 50_000;

async function readAll(t: TenantDb, table: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; from < MAX_ROWS_PER_TABLE; from += PAGE) {
    const { data, error } = await t.select(table).range(from, from + PAGE - 1);
    if (error) throw new Error(`Falha ao exportar ${table}: ${error.message}`);
    rows.push(...(data || []));
    if ((data?.length ?? 0) < PAGE) break;
  }
  return rows;
}

export async function exportTenant(t: TenantDb): Promise<{
  tenant: string;
  exported_at: string;
  tables: Record<string, unknown[]>;
}> {
  const tables: Record<string, unknown[]> = {};
  for (const name of TENANT_TABLES) tables[name] = await readAll(t, name);
  return { tenant: t.tenantId, exported_at: new Date().toISOString(), tables };
}
