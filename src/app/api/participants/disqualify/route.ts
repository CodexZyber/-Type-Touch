import { NextResponse } from 'next/server';
import { EventService } from '@/lib/store/event-store';
import { requireAdminSession } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { participantId, disqualified, reason } = body;

    if (!participantId) {
      return NextResponse.json(
        { success: false, error: 'Participant ID is required' },
        { status: 400 }
      );
    }

    if (disqualified && (!reason || reason.trim().length === 0)) {
      return NextResponse.json(
        { success: false, error: 'A disqualification reason is required.' },
        { status: 400 }
      );
    }

    const updated = await EventService.setDisqualification(
      participantId,
      Boolean(disqualified),
      reason
    );

    return NextResponse.json({
      success: true,
      participant: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Operation failed' },
      { status: 500 }
    );
  }
}
