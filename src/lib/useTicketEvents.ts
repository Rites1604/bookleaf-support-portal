"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Subscribes to the SSE feed and calls `onChange` with the ids of tickets that changed.
 * EventSource reconnects on its own (the server closes streams every ~50s); `live`
 * reflects whether a stream is currently open, for the small indicator in the header.
 */
export function useTicketEvents(onChange: (ids: string[]) => void) {
  const handler = useRef(onChange);
  handler.current = onChange;
  const [live, setLive] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/v1/events");
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.addEventListener("tickets", (e) => {
      try {
        handler.current(JSON.parse((e as MessageEvent).data).ids);
      } catch {
        /* ignore malformed event */
      }
    });
    return () => es.close();
  }, []);

  return live;
}
