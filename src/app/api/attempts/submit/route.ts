import { NextResponse } from 'next/server';
import { EventService } from '@/lib/store/event-store';
import { SubmissionPayload } from '@/types';

export async function POST(request: Request) {
  try {
    const payload: SubmissionPayload = await request.json();

    if (!payload.participantId) {
      return NextResponse.json(
        { success: false, error: 'Missing participant identity.' },
        { status: 400 }
      );
    }

    if (!payload.startedAt || !payload.completedAt) {
      return NextResponse.json(
        { success: false, error: 'Invalid attempt timestamps.' },
        { status: 400 }
      );
    }

    // Process submission via EventService (handles server validation, 85% rule, PB logic)
    const result = await EventService.submitAttempt(payload);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Submission rejected by server' },
      { status: 400 }
    );
  }
}
