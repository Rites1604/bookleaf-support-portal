import { ANY_ROLE, route } from "@/server/http/route";
import { changedTicketIds } from "@/server/services/ticketService";

export const dynamic = "force-dynamic";
// Serverless functions can't hold a connection forever. The stream ends before this limit and
// EventSource reconnects automatically, resuming from Last-Event-ID, so no update is lost.
export const maxDuration = 60;

const POLL_MS = 2000;
const STREAM_LIFETIME_MS = 50_000;

/**
 * Server-Sent Events feed of ticket changes visible to the caller.
 *
 * Why DB polling behind SSE instead of an in-memory pub/sub: on serverless hosting the request
 * that writes a ticket and the request holding the stream usually run in different instances,
 * so an in-process emitter would miss events. Polling an indexed `updatedAt` column every 2s is
 * cheap at this scale and works on any host. With a long-lived server, swap this for
 * Postgres LISTEN/NOTIFY or Redis pub/sub without changing the client.
 */
export const GET = route(ANY_ROLE, async ({ req, session }) => {
  const resumeFrom = req.headers.get("last-event-id") ?? req.nextUrl.searchParams.get("since");
  let cursor = resumeFrom && !Number.isNaN(Date.parse(resumeFrom)) ? new Date(resumeFrom) : new Date();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const startedAt = Date.now();
      let closed = false;
      req.signal.addEventListener("abort", () => (closed = true));

      send(`retry: 3000\n: connected\n\n`);
      while (!closed && Date.now() - startedAt < STREAM_LIFETIME_MS) {
        try {
          const changes = await changedTicketIds(session, cursor);
          if (changes.length) {
            cursor = changes[changes.length - 1].updatedAt;
            const payload = JSON.stringify({ ids: changes.map((c) => c.id) });
            send(`id: ${cursor.toISOString()}\nevent: tickets\ndata: ${payload}\n\n`);
          } else {
            send(`: keep-alive\n\n`);
          }
        } catch (err) {
          console.error("[events] poll failed", err);
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
      if (!closed) controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
