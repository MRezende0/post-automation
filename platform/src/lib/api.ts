// api.ts: resposta de erro padrão das rotas. Sessão vencida = 401; erro de domínio = 400 com a
// mensagem; o resto = 500 neutro, com o detalhe só no log.

import { NextResponse } from 'next/server';
import { UserError, GENERIC_ERROR, userMessage } from './errors';
import { UnauthorizedError } from './session';
import { logError } from './log';

export function apiError(e: unknown, scope: string): NextResponse {
  if (e instanceof UnauthorizedError) return NextResponse.json({ error: e.message }, { status: 401 });
  if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: 400 });
  logError(scope, e);
  return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

// Páginas: mesma regra das rotas, devolvendo o texto que a tela mostra.
export function pageError(e: unknown, scope: string): string {
  if (!(e instanceof UserError)) logError(scope, e);
  return userMessage(e);
}
