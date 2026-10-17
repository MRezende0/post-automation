import { NextResponse } from 'next/server';
import { nextFreeSlot } from '@/lib/slots';
import { requirePermission } from '@/lib/session';
import { parseChannel } from '@/lib/route-input';
import { apiError, badRequest } from '@/lib/api';

export async function GET(req: Request) {
  try {
    const t = await requirePermission('content.view');
    const channel = parseChannel(new URL(req.url).searchParams.get('channel'));
    if (!channel.ok) return badRequest(channel.error);
    return NextResponse.json({ scheduledFor: await nextFreeSlot(t, channel.value) });
  } catch (e) {
    return apiError(e, 'api/next-slot');
  }
}
