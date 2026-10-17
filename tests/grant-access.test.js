import { describe, it, expect } from 'vitest';
import { validate } from '../scripts/grant-access.js';

describe('grant-access', () => {
  it('aceita e-mail, conta e papel válidos', () => {
    expect(validate({ email: 'ana@empresa.com', tenant: 'acme', role: 'viewer' })).toBeNull();
  });

  it('recusa e-mail, conta ou papel inválidos', () => {
    expect(validate({ email: 'ana', tenant: 'acme', role: 'admin' })).toMatch(/--email/);
    expect(validate({ email: 'ana@empresa.com', tenant: 'Acme', role: 'admin' })).toMatch(/--tenant/);
    for (const role of ['owner', 'editor', undefined]) {
      expect(validate({ email: 'ana@empresa.com', tenant: 'acme', role })).toMatch(/--role/);
    }
  });
});
