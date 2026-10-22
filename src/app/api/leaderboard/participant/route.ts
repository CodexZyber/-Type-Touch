import { NextResponse } from 'next/server';
import { EventService } from '@/lib/store/event-store';

export const dynamic = 'force-dynamic';

/**
 * Public detail for one ranked student: their attempts (scores and timelines)
 * for the leaderboard detail panel. Exposes only what the leaderboard already
 * shows plus per-attempt metrics; never email or session identifiers.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const participantId = searchParams.get('participantId');
    if (!participantId) {
      return NextResponse.json({ success: false, error: 'participantId is required' }, { status: 400 });
    }

    const participant = await EventService.getParticipant(participantId);
    if (!participant || participant.disqualified) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const attempts = (await EventService.getParticipantAttempts(participantId))
      .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime())
      .map((a) => ({
        id: a.id,
        round: a.round || 'QUALIFIER',
        completed_at: a.completed_at,
        elapsed_seconds: a.elapsed_seconds,
        wpm: a.wpm,
        wpm_display: a.wpm_display,
        raw_wpm: a.raw_wpm,
        accuracy: a.accuracy,
        consistency: a.consistency,
        correct_characters: a.correct_characters,
        incorrect_characters: a.incorrect_characters,
        total_characters: a.total_characters,
        total_keystrokes: a.total_keystrokes,
        incorrect_keystrokes: a.incorrect_keystrokes,
        corrections: a.corrections,
        qualified: a.qualified,
        timeline: a.timeline || [],
      }));

    return NextResponse.json({
      success: true,
      participant: { id: participant.id, name: participant.name, student_id: participant.student_id },
      attempts,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed' }, { status: 500 });
  }
}
