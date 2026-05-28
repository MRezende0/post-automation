// metrics.js — coleta insights semanais dos dois canais. TODO: implementar.
// Chamado por: .github/workflows/weekly-report.yml (domingo 20h).

import 'dotenv/config';
import { notify } from './telegram.js';

async function main() {
  // TODO: chamar Graph API /{ig-media-id}/insights pra reach, saved, profile_views
  // TODO: chamar LinkedIn /rest/socialActions/{share-urn}/likes, comments, impressions
  // TODO: ler content/published.yaml, juntar com métricas, gerar markdown
  // TODO: enviar resumo via notify()

  const report = [
    '📊 *Relatório semanal* (placeholder)',
    '',
    '_Coleta de métricas ainda não implementada._',
    '_Próximos passos: integrar Graph API insights + LinkedIn analytics._',
  ].join('\n');

  await notify(report);
  console.log('[metrics] Relatório enviado (placeholder)');
}

main().catch(err => {
  console.error('[metrics] ERRO:', err);
  process.exit(1);
});
