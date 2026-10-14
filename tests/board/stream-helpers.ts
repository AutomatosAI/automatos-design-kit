import { vi } from "vitest";

import type { Fetch } from "@/lib/client/api";

// A board stream the test drives by hand (B-002): push SSE text, end it, or drop it. Like
// a real fetch body, it errors with an AbortError when the request's signal aborts.

export const WORKSPACE = { id: "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10", name: "Home" };

export const HEARTBEAT = ": hb\n\n";

const encoder = new TextEncoder();

export function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function boardChanged(taskId: number = 7): string {
  return sseFrame("board_changed", { workspace_id: WORKSPACE.id, task_id: taskId, status: "review" });
}

export interface ControlledStream {
  readonly body: ReadableStream<Uint8Array>;
  readonly signal: AbortSignal | undefined;
  readonly push: (text: string) => void;
  readonly end: () => void;
  readonly drop: () => void;
}

export function controlledStream(signal?: AbortSignal): ControlledStream {
  let open = true;
  let control: ReadableStreamDefaultController<Uint8Array> | null = null;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      control = controller;
    },
  });
  const settle = (how: (controller: ReadableStreamDefaultController<Uint8Array>) => void) => {
    if (!open || !control) return;
    open = false;
    how(control);
  };
  signal?.addEventListener("abort", () =>
    settle((controller) => controller.error(new DOMException("The operation was aborted.", "AbortError"))),
  );
  return {
    body,
    signal,
    push: (text) => {
      if (open && control) control.enqueue(encoder.encode(text));
    },
    end: () => settle((controller) => controller.close()),
    drop: () => settle((controller) => controller.error(new TypeError("network error"))),
  };
}

/** What each call to /api/tasks/stream gets, in turn: an open stream, or a 502. Past the end: streams. */
export type StreamAnswer = "stream" | "fail";

export function mockStreamFetch(answers: readonly StreamAnswer[] = []) {
  const streams: ControlledStream[] = [];
  let calls = 0;
  const fetch = vi.fn<Fetch>(async (input, init) => {
    if (input === "/api/workspace") return Response.json(WORKSPACE);
    if (input !== "/api/tasks/stream") return Response.json({ error: `unexpected ${input}` }, { status: 404 });
    const answer = answers[calls] ?? "stream";
    calls += 1;
    if (answer === "fail") return Response.json({ error: "Automatos isn't running." }, { status: 502 });
    const stream = controlledStream(init?.signal ?? undefined);
    streams.push(stream);
    return new Response(stream.body, { headers: { "Content-Type": "text/event-stream" } });
  });
  const streamCalls = () => fetch.mock.calls.filter(([input]) => input === "/api/tasks/stream");
  return { fetch, streams, streamCalls };
}
