// Keeps the board's live stream open (board-analytics.md, "Live updates"): reads it with
// fetch and a ReadableStream reader (not EventSource, so the workspace header goes with
// it), calls onChange once per chunk that carries a board_changed frame, and when the
// stream drops or fails, reconnects after 1 s, doubling up to 30 s. Any bytes from the
// backend (a frame or a heartbeat) mean it is answering again, so the backoff starts over.
// The returned stop() aborts the open request and any reconnect waiting to happen.

import { INITIAL_SSE, isBoardChange, parseSseChunk, reconnectDelay } from "@/lib/board/stream";

export interface BoardStreamSource {
  /** Opens GET /api/tasks/stream; a failed answer throws. */
  readonly open: (signal: AbortSignal) => Promise<Response>;
  /** The board changed: refetch the list. */
  readonly onChange: () => void;
}

const LABEL = "[board stream]";

/** Runs a caller's callback without letting its error end the stream or the timer. */
export function callSafely(fn: () => void, what: string): void {
  try {
    fn();
  } catch (error) {
    console.error(`${LABEL} ${what} failed:`, error);
  }
}

export function connectBoardStream({ open, onChange }: BoardStreamSource): () => void {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  async function readOnce(): Promise<void> {
    const response = await open(controller.signal);
    if (!response.body) throw new Error("The board stream answered without a body");
    const reader = response.body.getReader();
    let state = INITIAL_SSE;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      attempt = 0;
      const step = parseSseChunk(state, value);
      state = step.state;
      if (step.frames.some(isBoardChange)) callSafely(onChange, "Refetching the board");
    }
  }

  async function run(): Promise<void> {
    timer = null;
    try {
      await readOnce();
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error(`${LABEL} The live board stream dropped; reconnecting.`, error);
    }
    if (controller.signal.aborted) return;
    const delay = reconnectDelay(attempt);
    attempt += 1;
    timer = setTimeout(() => void run(), delay);
  }

  void run();
  return () => {
    controller.abort();
    if (timer !== null) clearTimeout(timer);
  };
}
