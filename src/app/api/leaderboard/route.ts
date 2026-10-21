import { NextResponse } from 'next/server';
import { EventService } from '@/lib/store/event-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    const event = await EventService.getActiveEvent();
    const targetEventId = eventId || event.id;

    const leaderboard = await EventService.getLeaderboard(targetEventId);

    return NextResponse.json({
      success: true,
      leaderboard,
      eventStatus: event.status,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
