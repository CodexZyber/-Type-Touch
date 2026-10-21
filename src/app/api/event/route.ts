import { NextResponse } from 'next/server';
import { EventService } from '@/lib/store/event-store';
import { requireAdminSession } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const event = await EventService.getActiveEvent();
    return NextResponse.json({
      success: true,
      event,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { action, updates } = body;

    let updatedEvent;
    if (action === 'start') {
      updatedEvent = await EventService.startEvent(updates?.durationMinutes);
    } else if (action === 'pause') {
      updatedEvent = await EventService.pauseEvent();
    } else if (action === 'end') {
      updatedEvent = await EventService.endEvent();
    } else if (action === 'reset') {
      updatedEvent = await EventService.resetEvent(updates?.clearAttempts ?? true);
    } else {
      updatedEvent = await EventService.updateEvent(updates || {});
    }

    return NextResponse.json({
      success: true,
      event: updatedEvent,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update event' },
      { status: 400 }
    );
  }
}
