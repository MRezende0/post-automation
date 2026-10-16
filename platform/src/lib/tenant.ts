// Id de tenant (ADR 0005): o mesmo formato que a tabela `tenants` aceita. Sem dependência,
// pra caber no middleware (edge).
const TENANT_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;

export function isTenantId(value: unknown): value is string {
  return typeof value === 'string' && TENANT_RE.test(value);
}
