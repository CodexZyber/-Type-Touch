import { NextResponse } from 'next/server';
import { EventService } from '@/lib/store/event-store';
import { requireAdminSession } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const stats = await EventService.getAdminStats();
    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch admin stats' },
      { status: 500 }
    );
  }
}
