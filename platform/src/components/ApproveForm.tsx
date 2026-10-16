'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtDateTime, isoToLocalInput, localInputToIso } from '@/lib/format';
import { splitThread } from '@/lib/thread';
import FeedbackForm from './FeedbackForm';
import type { PendingApproval, Variation } from '@/lib/types';

function carouselNote(v?: Variation): string {
  if (v?.format !== 'carousel') return '';
  const n = v.slideUrls?.length ?? 0;
  if (n < 2) return 'Carrossel sem slides renderizados: sai como imagem única';
  return v.documentUrl ? `Carrossel: ${n} slides e PDF prontos` : `Carrossel: ${n} slides prontos`;
}

export default function ApproveForm({
  pending,
  suggested,
  nextSlot,
}: {
  pending: PendingApproval;
  suggested: Record<number, string>;
  nextSlot: string | null;
}) {
  const variations = pending.generation?.variations || [];
  const images = pending.images || [];
  const router = useRouter();

  const defaultCaption = pending.top_id ?? variations[0]?.id ?? 1;
  const defaultArt = images.find((i) => i.url)?.id ?? images[0]?.id ?? defaultCaption;

  const [captionId, setCaptionId] = useState<number>(defaultCaption);
  const [artId, setArtId] = useState<number>(defaultArt);
  const [captionText, setCaptionText] = useState<string>(suggested[defaultCaption] ?? '');
  const [edited, setEdited] = useState(false);
  const [mode, setMode] = useState<'slot' | 'manual'>(nextSlot ? 'slot' : 'manual');
  const [manual, setManual] = useState<string>(nextSlot ? isoToLocalInput(nextSlot) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const chosenVariation = useMemo(() => variations.find((v) => v.id === captionId), [variations, captionId]);
  const tweets = useMemo(() => (pending.channel === 'twitter' ? splitThread(captionText) : []), [pending.channel, captionText]);

  function selectCaption(id: number) {
    setCaptionId(id);
    if (!edited) setCaptionText(suggested[id] ?? ''); // só re-semeia se você não editou ainda
  }

  async function approve() {
    setBusy(true);
    setError('');
    const scheduledFor = mode === 'manual' && manual ? localInputToIso(manual) : undefined;
    const res = await fetch('/api/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pendingId: pending.pending_id, captionId, artId, captionText, scheduledFor }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      router.push('/calendar');
      router.refresh();
    } else {
      setError(j.error || 'Falha ao agendar');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">Aprovar post</h1>
        <span className="chip uppercase">{pending.channel}</span>
        {pending.generation?.pillar && <span className="chip">{pending.generation.pillar}</span>}
        {pending.generation?.angle && <span className="chip">{pending.generation.angle}</span>}
      </div>

      {pending.generation?.judge_reason && (
        <p className="text-xs text-muted">🧠 judge: {pending.generation.judge_reason}</p>
      )}

      {/* 1. Legenda */}
      <section className="space-y-2">
        <h2 className="label">1 · Legenda</h2>
        <div className="grid gap-2 md:grid-cols-3">
          {variations.map((v) => (
            <button
              key={v.id}
              onClick={() => selectCaption(v.id)}
              className={`card text-left text-sm transition ${
                captionId === v.id ? 'border-accent ring-1 ring-accent' : 'hover:border-muted'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">#{v.id}</span>
                <span className="chip">{v.format || 'single'}</span>
              </div>
              <p className="mt-1 line-clamp-3 text-muted">{v.hook}</p>
            </button>
          ))}
        </div>
        <textarea
          value={captionText}
          onChange={(e) => {
            setCaptionText(e.target.value);
            setEdited(true);
          }}
          rows={10}
          className="w-full rounded-lg border border-edge bg-ink px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <p className="text-xs text-muted">
          {captionText.length} caracteres {edited && '· editado'} ·{' '}
          <button
            type="button"
            className="underline hover:text-white"
            onClick={() => {
              setCaptionText(suggested[captionId] ?? '');
              setEdited(false);
            }}
          >
            restaurar sugestão
          </button>
        </p>
        {tweets.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted">
              {tweets.length === 1 ? 'Sai como 1 tweet.' : `Sai como thread de ${tweets.length} tweets.`} Linha em branco
              separa os tweets.
            </p>
            <ol className="space-y-1">
              {tweets.map((t, i) => (
                <li key={i} className="rounded-md border border-edge px-3 py-2 text-sm">
                  <p className="whitespace-pre-line">{t}</p>
                  <p className="mt-1 text-right text-xs text-muted">{t.length}/280</p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      {/* 2. Arte */}
      <section className="space-y-2">
        <h2 className="label">2 · Arte</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.length === 0 && <p className="text-sm text-muted">Sem artes nesta pendência.</p>}
          {images.map((im) => (
            <button
              key={im.id}
              onClick={() => setArtId(im.id)}
              className={`overflow-hidden rounded-lg border transition ${
                artId === im.id ? 'border-accent ring-1 ring-accent' : 'border-edge hover:border-muted'
              }`}
            >
              {im.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={im.url} alt={`arte ${im.id}`} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center text-xs text-muted">#{im.id}</div>
              )}
              <div className="px-2 py-1 text-left text-xs text-muted">#{im.id}</div>
            </button>
          ))}
        </div>
      </section>

      {/* 3. Agendamento */}
      <section className="space-y-2">
        <h2 className="label">3 · Quando publicar</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setMode('slot')}
            disabled={!nextSlot}
            className={mode === 'slot' ? 'btn-primary' : 'btn-ghost'}
          >
            Próximo slot livre
            {nextSlot ? ` · ${fmtDateTime(nextSlot)}` : ' · (sem slots)'}
          </button>
          <button onClick={() => setMode('manual')} className={mode === 'manual' ? 'btn-primary' : 'btn-ghost'}>
            Horário manual
          </button>
        </div>
        {mode === 'manual' && (
          <input
            type="datetime-local"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            className="rounded-lg border border-edge bg-ink px-3 py-2 text-sm outline-none focus:border-accent"
          />
        )}
        {mode === 'slot' && !nextSlot && (
          <p className="text-xs text-amber-300">Grade vazia/saturada — use horário manual ou adicione slots em /settings.</p>
        )}
      </section>

      {/* 4. Feedback: entra no prompt das próximas gerações (SPEC 003 R4) */}
      <details className="card space-y-3">
        <summary className="cursor-pointer text-sm">
          <span className="label">4 · O que achou deste post</span>
          <span className="ml-2 text-xs text-muted">opcional, ensina as próximas gerações</span>
        </summary>
        <div className="pt-3">
          <FeedbackForm channel={pending.channel} pendingId={pending.pending_id} excerpt={chosenVariation?.hook} />
        </div>
      </details>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {rejecting && (
        <section className="card space-y-2 border-red-900/60">
          <h2 className="label">Por que rejeitar?</h2>
          <p className="text-xs text-muted">O motivo vira anti-exemplo e entra no prompt das próximas gerações.</p>
          <FeedbackForm
            mode="reject"
            channel={pending.channel}
            pendingId={pending.pending_id}
            excerpt={chosenVariation?.hook}
            onCancel={() => setRejecting(false)}
          />
        </section>
      )}

      <div className="flex gap-2 border-t border-edge pt-4">
        <button onClick={approve} disabled={busy || (mode === 'slot' && !nextSlot)} className="btn-primary">
          {busy ? 'Agendando…' : 'Aprovar e agendar'}
        </button>
        <button onClick={() => setRejecting(true)} disabled={busy || rejecting} className="btn-danger">
          Rejeitar
        </button>
        <span className="ml-auto self-center text-xs text-muted">
          {carouselNote(chosenVariation)}
        </span>
      </div>
    </div>
  );
}
