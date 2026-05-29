import { NextResponse } from 'next/server';
import { nextFreeSlot } from '@/lib/slots';
import type { Channel } from '@/lib/types';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const channel = searchParams.get('channel') as Channel | null;
    if (channel !== 'instagram' && channel !== 'linkedin') {
      return NextResponse.json({ error: 'channel inválido' }, { status: 400 });
    }
    const slot = await nextFreeSlot(channel);
    return NextResponse.json({ scheduledFor: slot });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro' }, { status: 400 });
  }
}
