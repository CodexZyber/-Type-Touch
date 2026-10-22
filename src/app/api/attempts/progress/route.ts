import { NextResponse } from 'next/server';
import { EventService } from '@/lib/store/event-store';
import { setProgress } from '@/lib/realtime/live';

export const dynamic = 'force-dynamic';

const clamp = (n: unknown, lo: number, hi: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
};

/**
 * Finalists report their in-progress attempt (about once a second) while the
 * Grand Final is live, so spectators see the race as it happens. Nothing is
 * stored; the hub broadcasts it to live viewers and forgets it.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { participantId, sessionId } = body;
    if (!participantId || !sessionId) {
      return NextResponse.json({ success: false, error: 'Missing participant identity.' }, { status: 400 });
    }

    const event = await EventService.getActiveEvent();
    if (event.final_status !== 'LIVE') {
      return NextResponse.json({ success: false, error: 'The Grand Final is not live.' }, { status: 409 });
    }
    if (!event.finalist_ids.includes(participantId)) {
      return NextResponse.json({ success: false, error: 'Not a finalist.' }, { status: 403 });
    }

    const participant = await EventService.getParticipant(participantId);
    if (!participant || participant.session_id !== sessionId) {
      return NextResponse.json({ success: false, error: 'Unknown participant session.' }, { status: 403 });
    }

    setProgress({
      participant_id: participantId,
      wpm: Math.round(clamp(body.wpm, 0, 400)),
      accuracy: Math.round(clamp(body.accuracy, 0, 100) * 100) / 100,
      progress: Math.round(clamp(body.progress, 0, 100)),
      state: body.state === 'DONE' ? 'DONE' : 'TYPING',
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Bad request' }, { status: 400 });
  }
}
