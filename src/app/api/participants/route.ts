import { NextResponse } from 'next/server';
import { EventService } from '@/lib/store/event-store';
import { requireAdminSession } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const participantId = searchParams.get('participantId');

    // Public route: Individual participant querying their own attempts & remaining quota
    if (participantId) {
      const participant = await EventService.getParticipant(participantId);
      const attempts = await EventService.getParticipantAttempts(participantId);
      const event = await EventService.getActiveEvent();
      const maxAttempts = event.max_attempts;
      const attemptsCount = attempts.length;
      const attemptsRemaining = maxAttempts !== null ? Math.max(0, maxAttempts - attemptsCount) : null;
      return NextResponse.json({
        success: true,
        // null when the server doesn't know this id (e.g. stale browser storage)
        participant,
        attempts,
        attemptsCount,
        maxAttempts,
        attemptsRemaining,
      });
    }

    // Administrative route: Full participant list export/view requires admin session
    const auth = await requireAdminSession(request);
    if (!auth.authorized) {
      return auth.response;
    }

    const event = await EventService.getActiveEvent();
    const targetEventId = eventId || event.id;
    const participants = await EventService.getAllParticipants(targetEventId);

    return NextResponse.json({ success: true, participants });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch participants' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventId, name, studentId, email, sessionId } = body;

    if (!name || !studentId) {
      return NextResponse.json(
        { success: false, error: 'Full Name and Student ID are required.' },
        { status: 400 }
      );
    }

    const event = await EventService.getActiveEvent();
    const targetEventId = eventId || event.id;

    const participant = await EventService.registerParticipant(
      targetEventId,
      name,
      studentId,
      email,
      sessionId
    );

    return NextResponse.json({
      success: true,
      participant,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Registration failed' },
      { status: 500 }
    );
  }
}
