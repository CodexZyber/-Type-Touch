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
    const { action, enable } = body;

    if (action === 'toggle_mode') {
      const event = await EventService.configureDemoMode(Boolean(enable));
      return NextResponse.json({ success: true, event });
    }

    if (action === 'simulate_activity') {
      await EventService.simulateDemoActivity();
      const stats = await EventService.getAdminStats();
      return NextResponse.json({ success: true, stats });
    }

    return NextResponse.json({ success: false, error: 'Unknown demo action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Demo operation failed' },
      { status: 500 }
    );
  }
}
