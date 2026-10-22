import { addClient, removeClient, buildSnapshot } from '@/lib/realtime/live';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Keeps proxies (nginx) and browsers from timing out an idle stream. */
const HEARTBEAT_MS = 15_000;

/**
 * Server-Sent Events feed for the live leaderboard.
 *
 * Events:
 *   update   — full snapshot: event, qualifier leaderboard, Grand Final standings, progress
 *   progress — finalists' in-progress attempts (while the Grand Final is live)
 *
 * The first message is always an `update`, so a client needs no separate fetch.
 */
export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let clientId = 0;
  let heartbeat: NodeJS.Timeout | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (eventName: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      clientId = addClient(write);

      const cleanup = () => {
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
        removeClient(clientId);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      request.signal.addEventListener('abort', cleanup);

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          cleanup();
        }
      }, HEARTBEAT_MS);

      try {
        write('update', await buildSnapshot());
      } catch (err: any) {
        write('error', { message: err?.message || 'Failed to load snapshot' });
      }
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      removeClient(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Tell nginx not to buffer this response
      'X-Accel-Buffering': 'no',
    },
  });
}
