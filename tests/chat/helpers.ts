// A mocked fetch for Play's own routes, for the chat hook and chat screen tests:
// /api/workspace answers a workspace, /api/chat streams the planned chunks, and
// /api/chat/{id}/cancel says it cancelled. Every call is recorded by vi.fn.

import { vi } from "vitest";

import type { AutoMessage, ChatMessage } from "@/lib/chat/types";
import type { Fetch } from "@/lib/client/api";

import { chunkRandomly, fixtureBytes, type FixtureName, seededRandom } from "../stream/helpers";

export const WORKSPACE = { id: "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10", name: "Home" };

/** The chat-id in every fixture. */
export const FIXTURE_CHAT_ID = "6f1c2a9e-3b7d-4c8a-9e21-5d0f4b8a7c13";

const MAX_CHUNK = 48;
const encoder = new TextEncoder();

/**
 * What /api/chat answers. A stream sends its chunks one read at a time, then
 * closes, errors with failWith, or (hang) waits until the fetch is aborted.
 */
export type StreamAnswer = {
  readonly kind: "stream";
  readonly chunks: readonly Uint8Array[];
  readonly hang?: boolean;
  readonly failWith?: Error;
};

export type ChatAnswer = StreamAnswer | { readonly kind: "status"; readonly status: number; readonly body: unknown };

/** A fixture cut into random chunks (seeded, so a failure replays). */
export function fixtureAnswer(name: FixtureName, seed = 7): StreamAnswer {
  return { kind: "stream", chunks: chunkRandomly(fixtureBytes(name), seededRandom(seed), MAX_CHUNK) };
}

/** Stream lines that stop and wait: the turn is still running until stop() aborts it. */
export function hangingAnswer(lines: readonly string[]): StreamAnswer {
  return { kind: "stream", chunks: lines.map((line) => encoder.encode(`${line}\n`)), hang: true };
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

function waitForAbort(
  controller: ReadableStreamDefaultController<Uint8Array>,
  signal?: AbortSignal | null,
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      controller.error(abortError());
      resolve();
      return;
    }
    signal?.addEventListener(
      "abort",
      () => {
        controller.error(abortError());
        resolve();
      },
      { once: true },
    );
  });
}

function streamBody(
  answer: StreamAnswer,
  signal?: AbortSignal | null,
): ReadableStream<Uint8Array> {
  let next = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = answer.chunks[next];
      next += 1;
      if (chunk) return controller.enqueue(chunk);
      if (answer.failWith) return controller.error(answer.failWith);
      if (answer.hang) return waitForAbort(controller, signal);
      return controller.close();
    },
  });
}

function chatResponse(answer: ChatAnswer, signal?: AbortSignal | null): Response {
  if (answer.kind === "status") return Response.json(answer.body, { status: answer.status });
  return new Response(streamBody(answer, signal), {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

const CANCEL_PATH = /^\/api\/chat\/[^/]+\/cancel$/;

/** Answers for other routes, by path without the query, e.g. "/api/chat/history". */
export type Routes = Readonly<Record<string, () => Response>>;

/** Turn n of the conversation gets answers[n] (the last one repeats); routes answer the rest. */
export function mockChatFetch(answers: readonly ChatAnswer[], routes: Routes = {}) {
  let turn = 0;
  return vi.fn<Fetch>(async (input, init) => {
    const path = input.split("?")[0] ?? input;
    if (path === "/api/workspace") return Response.json(WORKSPACE);
    if (CANCEL_PATH.test(path)) return Response.json({ cancelled: true });
    const route = routes[path];
    if (route) return route();
    const answer = answers[Math.min(turn, answers.length - 1)];
    if (path !== "/api/chat" || !answer) throw new Error(`unexpected call to ${input}`);
    turn += 1;
    return chatResponse(answer, init?.signal);
  });
}

export function callsTo(fetchMock: ReturnType<typeof mockChatFetch>, path: string): readonly RequestInit[] {
  return fetchMock.mock.calls.filter(([input]) => input === path).map(([, init]) => init ?? {});
}

/** Auto's newest reply. */
export function lastReply(messages: readonly ChatMessage[]): AutoMessage {
  const reply = messages.findLast((message): message is AutoMessage => message.role === "assistant");
  if (!reply) throw new Error("no reply from Auto");
  return reply;
}
