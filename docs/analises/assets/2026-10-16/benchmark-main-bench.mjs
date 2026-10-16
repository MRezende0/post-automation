// Benchmark na main: uma ideia por rodada (SPEC 003). Só Gemini, sem publicar, sem upload, sem banco.
import { writeFile } from 'node:fs/promises';
import {
  generatePost, critiqueVariations, judgeVariations, polishPost, checkGuardrails,
  adaptPost, composeCaption,
} from './src/generate.js';
import { pickMotherChannel, motherFormat, buildReusePlan } from './src/utils/brief.js';
import { resolveTenant } from './src/tenant.js';

const tenant = resolveTenant();
const context = `Série de dica e dor sobre custo real de projeto: hora do sócio, revisões não cobradas, retrabalho por versão errada, prazo que estoura. Cada peça mostra uma conta concreta e termina com a pergunta "você sabe esse número no seu escritório?". Escritório de projeto de engenharia e arquitetura, nunca construtora.`;
const channels = ['instagram', 'linkedin', 'twitter'];
const pillar = 'dor';
const t0 = Date.now();

const mother = pickMotherChannel({ channels, pillar, campaign: null, tenant, preferred: [] });
const gen = await generatePost({ channel: mother, pillar, context, tenant });
const critique = await critiqueVariations({ channel: mother, pillar: gen.pillar, variations: gen.variations, tenant });
const survivors = Array.isArray(critique) ? gen.variations.filter(v => !critique.find(c => c.id === v.id)?.refuted) : gen.variations;
const candidates = survivors.length ? survivors : gen.variations;
const verdict = await judgeVariations({ channel: mother, pillar: gen.pillar, variations: candidates, tenant });
const top = gen.variations.find(v => v.id === (verdict?.chosenId ?? candidates[0].id));
Object.assign(top, await polishPost({ channel: mother, pillar: gen.pillar, variation: top, tenant }));
const kind = motherFormat(top, { longTextChars: tenant.reuse?.longTextChars });
const plan = buildReusePlan({ channels, mother, kind, tenant });

const out = { mother, kind, plan, pillar: gen.pillar, angle: gen.angle, judge: verdict?.reason, posts: {} };
out.posts[mother] = { mode: 'mother', caption: composeCaption(top), guard: checkGuardrails(top, { pillar: gen.pillar, tenant }).flags };
for (const ch of channels) {
  const step = plan[ch];
  if (ch === mother) continue;
  if (step.mode === 'skip' || step.mode === 'locked') { out.posts[ch] = { mode: step.mode, reason: step.reason }; continue; }
  if (step.mode === 'reuse') {
    const adapted = await adaptPost({ fromChannel: mother, toChannel: ch, pillar: gen.pillar, angle: gen.angle, variation: top, kind, tenant });
    const v = adapted.variations[0];
    out.posts[ch] = { mode: 'reuse', caption: composeCaption(v), guard: checkGuardrails(v, { pillar: gen.pillar, tenant }).flags };
  } else {
    const own = await generatePost({ channel: ch, pillar: gen.pillar, angle: gen.angle, context, tenant });
    const v = own.variations[0];
    out.posts[ch] = { mode: 'own', caption: composeCaption(v) };
  }
}
out.seconds = Math.round((Date.now() - t0) / 1000);
await writeFile('./main-output.json', JSON.stringify(out, null, 2));
console.log('ok', out.seconds, 's');
