import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { channel, weekday, hour, minute } = body ?? {};
    if (!channel || weekday == null || hour == null) {
      return NextResponse.json({ error: 'channel, weekday e hour obrigatórios' }, { status: 400 });
    }
    const { error } = await db().from('publish_slots').insert({
      channel: String(channel),
      weekday: Number(weekday),
      hour: Number(hour),
      minute: Number(minute ?? 0),
      active: true,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    const { error } = await db().from('publish_slots').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro' }, { status: 400 });
  }
}
