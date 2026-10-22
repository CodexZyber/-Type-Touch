import { NextResponse } from 'next/server';
import { EventService } from '@/lib/store/event-store';
import { requireAdminSession } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const participantId = searchParams.get('participantId');

    // Public route: Individual participant querying their own attempts & remaining quota.
    // The participant record (with its session id) only goes back to the session that owns it;
    // participant ids are public on the leaderboard.
    if (participantId) {
      const sessionId = searchParams.get('sessionId');
      const found = await EventService.getParticipant(participantId);
      const participant = found && sessionId && found.session_id === sessionId ? found : null;
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

/**
 * Student sign-in. Only students the host created (scripts/students-add.mjs) can enter;
 * there is no open registration. `{action: 'logout', participantId, sessionId}` signs out.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (body.action === 'logout') {
      if (typeof body.participantId === 'string' && typeof body.sessionId === 'string') {
        await EventService.logoutStudent(body.participantId, body.sessionId);
      }
      return NextResponse.json({ success: true });
    }

    const username = typeof body.username === 'string' ? body.username : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!username.trim() || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required.' },
        { status: 400 }
      );
    }

    const participant = await EventService.loginStudent(username, password);
    if (!participant) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password.' },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true, participant });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Sign-in failed' },
      { status: 500 }
    );
  }
}
