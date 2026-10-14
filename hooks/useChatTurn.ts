// One chat turn at a time: sends the message through lib/client/api.ts, reads the
// stream with lib/stream/parse.ts, builds the message model (lib/chat/turn.ts) and
// feeds every parsed event to the mascot reducer. stop() cancels the turn on the
// backend and aborts the fetch. To open another conversation, remount with a new key.

import { type RefObject, useCallback, useEffect, useReducer, useRef, useState } from "react";

import {
  applyStreamEvent,
  autoMessage,
  endTurn,
  failTurn,
  turnRequest,
  updateMessage,
  userMessage,
  withNotice,
} from "@/lib/chat/turn";
import type { AutoMessage, ChatMessage } from "@/lib/chat/types";
import { api, type ApiClient, ApiError } from "@/lib/client/api";
import type { ChatTurnRequest } from "@/lib/client/types";
import { INITIAL_MASCOT, mascotReducer } from "@/lib/mascot/reducer";
import type { MascotEvent, MascotState } from "@/lib/mascot/types";
import { readStreamEvents } from "@/lib/stream/parse";
import type { FinishEvent } from "@/lib/stream/types";

export const STREAM_BROKE = "Auto's answer stopped coming through. Try sending it again.";
export const CANCEL_FAILED = "Play couldn't tell Auto to stop, so the answer may still finish in the background.";

/** Ends the turn for the mascot when the stream itself didn't (a stop, a dropped body, a failed request). */
const TURN_OVER: FinishEvent = { type: "finish", finishReason: null };

const BACKEND_DOWN_STATUS = 502;

export type ChatTurnOptions = {
  /** Tests pass their own (createApiClient with a mock fetch). */
  readonly client?: ApiClient;
  /** An existing conversation; "" (the default) opens a new one on the first send. */
  readonly chatId?: string;
  readonly initialMessages?: readonly ChatMessage[];
};

export type ChatTurn = {
  readonly chatId: string;
  readonly messages: readonly ChatMessage[];
  /** A turn is running: show Stop instead of Send. */
  readonly streaming: boolean;
  /** The mascot reducer's state: pass mascot.mascot to AutoMascot. */
  readonly mascot: MascotState;
  /** For the page's own mascot events (input-focus, clip-ended, …). */
  readonly dispatchMascot: (event: MascotEvent) => void;
  /** Resolves when the turn ends (never rejects); false when nothing was sent (empty, or a turn is running). */
  readonly send: (text: string) => Promise<boolean>;
  readonly stop: () => Promise<void>;
};

type ActiveTurn = { readonly controller: AbortController; readonly replyId: string };

/** Where a running turn writes: its reply, the mascot, and the conversation id. */
type TurnSink = {
  readonly update: (change: (message: AutoMessage) => AutoMessage) => void;
  readonly mascot: (event: MascotEvent) => void;
  readonly chatId: (id: string) => void;
};

/** Reads the whole stream into the sink; true when it ended the turn itself (finish or error). */
async function readTurn(
  client: ApiClient,
  request: ChatTurnRequest,
  signal: AbortSignal,
  sink: TurnSink,
): Promise<boolean> {
  const response = await client.streamChat(request, signal);
  if (!response.body) throw new Error("the chat answer arrived with no body");
  let ended = false;
  for await (const event of readStreamEvents(response.body)) {
    if (event.type === "chat-id") sink.chatId(event.chatId);
    sink.update((message) => applyStreamEvent(message, event));
    sink.mascot(event);
    ended = ended || event.type === "finish" || event.type === "error";
  }
  return ended;
}

function failedRequest(sink: TurnSink, error: unknown): void {
  console.error("[chat] the turn failed:", error);
  const message = error instanceof ApiError ? error.message : STREAM_BROKE;
  sink.update((reply) => failTurn(reply, message));
  if (error instanceof ApiError && error.status === BACKEND_DOWN_STATUS) {
    sink.mascot({ type: "backend-down" });
    return;
  }
  sink.mascot(TURN_OVER);
  sink.mascot({ type: "request-failed" });
}

/** Never throws: a stop, a failed request and a broken stream all end in the model. */
async function runTurn(
  client: ApiClient,
  request: ChatTurnRequest,
  signal: AbortSignal,
  sink: TurnSink,
): Promise<void> {
  try {
    const ended = await readTurn(client, request, signal, sink);
    if (!ended) {
      sink.update((reply) => endTurn(reply, "done"));
      sink.mascot(TURN_OVER);
    }
  } catch (error) {
    if (!signal.aborted) {
      failedRequest(sink, error);
      return;
    }
    sink.update((reply) => endTurn(reply, "stopped"));
    sink.mascot(TURN_OVER);
  }
}

/** Never throws: a cancel that fails is logged, and onFailed tells the user. */
async function cancelOnBackend(client: ApiClient, chatId: string, onFailed: () => void): Promise<void> {
  try {
    await client.cancelChat(chatId);
  } catch (error) {
    console.error("[chat] cancel failed:", error);
    onFailed();
  }
}

function abortActive(active: RefObject<ActiveTurn | null>): void {
  active.current?.controller.abort();
}

export function useChatTurn(options: ChatTurnOptions = {}): ChatTurn {
  const client = options.client ?? api;
  const [messages, setMessages] = useState<readonly ChatMessage[]>(options.initialMessages ?? []);
  const [chatId, setChatId] = useState(options.chatId ?? "");
  const [streaming, setStreaming] = useState(false);
  const [mascot, dispatchMascot] = useReducer(mascotReducer, INITIAL_MASCOT);
  const chatIdRef = useRef(chatId);
  const activeRef = useRef<ActiveTurn | null>(null);
  const serialRef = useRef(0);
  /** The last stop's cancel call: a new turn waits for it, so the cancel can't hit that turn. */
  const cancelRef = useRef<Promise<void>>(Promise.resolve());

  // Leaving the page drops the fetch (the backend finishes or cancels on its own).
  useEffect(() => () => abortActive(activeRef), []);

  const send = useCallback(
    async (input: string): Promise<boolean> => {
      const text = input.trim();
      if (!text || activeRef.current) return false;
      serialRef.current += 1;
      const serial = serialRef.current;
      const turn: ActiveTurn = { controller: new AbortController(), replyId: `local-${serial}-reply` };
      activeRef.current = turn;
      setStreaming(true);
      setMessages((prev) => [...prev, userMessage(`local-${serial}-you`, text), autoMessage(turn.replyId)]);
      dispatchMascot({ type: "send" });
      const sink: TurnSink = {
        update: (change) => setMessages((prev) => updateMessage(prev, turn.replyId, change)),
        mascot: dispatchMascot,
        chatId: (id) => {
          chatIdRef.current = id;
          setChatId(id);
        },
      };
      try {
        await cancelRef.current;
        await runTurn(client, turnRequest(chatIdRef.current, text), turn.controller.signal, sink);
      } finally {
        activeRef.current = null;
        setStreaming(false);
      }
      return true;
    },
    [client],
  );

  const stop = useCallback(async (): Promise<void> => {
    const turn = activeRef.current;
    if (!turn || turn.controller.signal.aborted) return;
    turn.controller.abort();
    // Before the chat-id frame there is no conversation id to cancel; the abort is all there is.
    const id = chatIdRef.current;
    if (!id) return;
    const cancelling = cancelOnBackend(client, id, () =>
      setMessages((prev) => updateMessage(prev, turn.replyId, (reply) => withNotice(reply, CANCEL_FAILED))),
    );
    cancelRef.current = cancelling;
    await cancelling;
  }, [client]);

  return { chatId, messages, streaming, mascot, dispatchMascot, send, stop };
}
