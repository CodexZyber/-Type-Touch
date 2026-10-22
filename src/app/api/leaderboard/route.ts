import { NextResponse } from 'next/server';
import { EventService } from '@/lib/store/event-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    const round = searchParams.get('round');

    const event = await EventService.getActiveEvent();
    const targetEventId = eventId || event.id;

    // ?round=final returns the Grand Final board (every finalist, ranked by final-round attempts)
    if (round && round.toLowerCase() === 'final') {
      const finalStandings = await EventService.getFinalStandings(event);
      return NextResponse.json({
        success: true,
        finalStandings,
        event,
        serverTime: new Date().toISOString(),
      });
    }

    const leaderboard = await EventService.getLeaderboardCached(targetEventId, 'QUALIFIER');

    return NextResponse.json({
      success: true,
      leaderboard,
      eventStatus: event.status,
      finalStatus: event.final_status,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
