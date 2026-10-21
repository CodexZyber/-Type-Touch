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
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'leaderboard'; // 'leaderboard' | 'all_attempts'

    const event = await EventService.getActiveEvent();

    if (type === 'all_attempts') {
      const attempts = await EventService.getAllAttempts(event.id);
      
      const headers = [
        'Attempt ID',
        'Participant Name',
        'Student ID',
        'Started At',
        'Completed At',
        'Elapsed Seconds',
        'WPM',
        'Accuracy %',
        'Correct Characters',
        'Incorrect Characters',
        'Total Characters',
        'Qualified',
        'Disqualified',
      ];

      const rows = attempts.map((a: any) => [
        `"${a.id}"`,
        `"${(a.participant?.name || 'Unknown').replace(/"/g, '""')}"`,
        `"${(a.participant?.student_id || 'N/A').replace(/"/g, '""')}"`,
        `"${a.started_at}"`,
        `"${a.completed_at}"`,
        a.elapsed_seconds,
        a.wpm_display ?? Math.round(a.wpm),
        a.accuracy,
        a.correct_characters,
        a.incorrect_characters,
        a.total_characters,
        a.qualified ? 'YES' : 'NO',
        a.participant?.disqualified ? 'YES' : 'NO',
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Tensor_MacTober_All_Attempts_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // Export Leaderboard
    const leaderboard = await EventService.getLeaderboard(event.id);
    const headers = [
      'Rank',
      'Name',
      'Student ID',
      'Best WPM',
      'Best Accuracy %',
      'Attempts',
      'Qualified',
      'Disqualified',
      'Best Attempt Timestamp',
    ];

    const rows = leaderboard.map((entry) => [
      entry.rank,
      `"${entry.name.replace(/"/g, '""')}"`,
      `"${entry.student_id.replace(/"/g, '""')}"`,
      entry.best_wpm,
      entry.best_accuracy,
      entry.attempts_count,
      'YES',
      'NO',
      `"${entry.last_attempt_at}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="Tensor_MacTober_Leaderboard_Results_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Export failed' },
      { status: 500 }
    );
  }
}
