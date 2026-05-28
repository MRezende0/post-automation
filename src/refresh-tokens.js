// refresh-tokens.js — renova tokens IG + LinkedIn antes do vencimento.
// Chamado por: .github/workflows/refresh-tokens.yml (mensal) e token-health-check.yml (diário, alerta).

import 'dotenv/config';
import * as instagram from './channels/instagram.js';
import * as linkedin from './channels/linkedin.js';
import { notify } from './telegram.js';

const MODE = process.argv[2] || 'refresh'; // refresh | check

async function main() {
  const results = {};

  results.instagram = await runStep('Instagram', async () => {
    if (MODE === 'check') return instagram.checkTokenHealth();
    return instagram.refreshToken();
  });

  results.linkedin = await runStep('LinkedIn', async () => {
    if (MODE === 'check') return linkedin.checkTokenHealth();
    return linkedin.refreshToken();
  });

  const summary = formatSummary(results);
  console.log(summary);

  const needsAlert = MODE === 'check' && hasUrgency(results);
  const failed = Object.values(results).some(r => r.error);

  if (needsAlert || failed) {
    await notify(summary).catch(() => {});
  }

  if (failed) process.exit(1);
}

async function runStep(name, fn) {
  try {
    const out = await fn();
    return { name, ok: true, ...out };
  } catch (e) {
    return { name, ok: false, error: e.message };
  }
}

function hasUrgency(results) {
  return Object.values(results).some(r => {
    if (typeof r.daysLeft === 'number' && r.daysLeft <= 10) return true;
    if (r.valid === false) return true;
    return false;
  });
}

function formatSummary(results) {
  const lines = [`🔑 *Token ${MODE}* — ${new Date().toISOString().slice(0, 10)}`];
  for (const r of Object.values(results)) {
    if (r.error) {
      lines.push(`❌ ${r.name}: ${r.error}`);
    } else {
      const days = r.daysLeft != null ? ` (${r.daysLeft}d restantes)` : '';
      lines.push(`✅ ${r.name}: ok${days}`);
    }
  }
  return lines.join('\n');
}

main().catch(err => {
  console.error('[refresh-tokens] ERRO:', err);
  process.exit(1);
});
