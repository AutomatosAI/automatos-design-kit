"use client";

// The chat with Auto (mocks 01 and 02). useChatTurn sends and streams; this screen lays
// out the conversation, the message box and Auto: in the mascot column on wide screens,
// and as a small row above the message box where that column is hidden (phones, and
// tablets below 1024 px). An empty chat is the first-open screen (mock 06), a reply that
// hit a snag offers Try again (mock 08), and Auto naps after 3 minutes without input.
// ChatScreen picks a new chat or a saved one (StoredChat).

import { useCallback, useEffect, useState } from "react";

import { AutoMascot } from "@/components/mascot/AutoMascot";
import { MascotColumn, PageColumns, PageHeader } from "@/components/shell/PageColumns";
import { type ChatTurn, useChatTurn } from "@/hooks/useChatTurn";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { useMediaQuery } from "@/hooks/useMediaPreferences";
import { chatCaption, latestReply } from "@/lib/chat/caption";
import type { ChatMessage } from "@/lib/chat/types";
import type { ApiClient } from "@/lib/client/api";
import { announceChatsChanged } from "@/lib/client/chat-events";
import { claimFirstOpen } from "@/lib/mascot/session";
import type { MascotName } from "@/lib/mascot/types";

import { ExampleChips, FirstOpenHero } from "./FirstOpen";
import { MessageBox } from "./MessageBox";
import { MessageList } from "./MessageList";
import styles from "./composer.module.css";

/** Matches the breakpoint where shell.module.css hides the mascot column. */
export const MASCOT_COLUMN_HIDDEN = "(max-width: 1023.98px)";
export const NEW_CHAT = "New chat";
const TITLE_CHARS = 60;

export interface ChatViewProps {
  /** Tests pass their own (createApiClient with a mock fetch). */
  readonly client?: ApiClient;
  /** The conversation to continue; none starts a new one on the first send. */
  readonly chatId?: string;
  readonly initialMessages?: readonly ChatMessage[];
  /** Words already in the message box when the chat opens. */
  readonly initialDraft?: string;
  /** How long without input before Auto naps (tests shorten it). */
  readonly idleMs?: number;
}

/** The conversation's name: its first message (the messages route doesn't carry the backend's title). */
export function chatTitle(messages: readonly ChatMessage[]): string {
  const first = messages.find((message) => message.role === "user")?.text.replace(/\s+/g, " ").trim();
  if (!first) return NEW_CHAT;
  return first.length <= TITLE_CHARS ? first : `${first.slice(0, TITLE_CHARS - 1).trimEnd()}…`;
}

/** The page's own mascot events: hello on the first open, focus, clip ends, and the idle nap. */
function useChatMascot(dispatchMascot: ChatTurn["dispatchMascot"], idleMs?: number) {
  useEffect(() => {
    if (claimFirstOpen()) dispatchMascot({ type: "app-open" });
  }, [dispatchMascot]);
  const onIdle = useCallback(() => dispatchMascot({ type: "idle-timeout" }), [dispatchMascot]);
  const onWake = useCallback(() => dispatchMascot({ type: "wake" }), [dispatchMascot]);
  useIdleTimeout(onIdle, onWake, idleMs);
  return {
    onClipEnded: useCallback((state: MascotName) => dispatchMascot({ type: "clip-ended", state }), [dispatchMascot]),
    onFocus: useCallback(() => dispatchMascot({ type: "input-focus" }), [dispatchMascot]),
    onBlur: useCallback(() => dispatchMascot({ type: "input-blur" }), [dispatchMascot]),
  };
}

/** A send that announces the turn: it moved its conversation to the top of the history (or made it). */
function useAnnouncedSend(sendTurn: ChatTurn["send"]): ChatTurn["send"] {
  return useCallback(
    async (text: string): Promise<boolean> => {
      const sent = await sendTurn(text);
      if (sent) announceChatsChanged();
      return sent;
    },
    [sendTurn],
  );
}

/** Try again for the newest reply's snag box: your last message, sent again. None mid-turn. */
function retryLast(turn: ChatTurn, send: ChatTurn["send"]): (() => void) | undefined {
  const lastAsked = turn.messages.findLast((message) => message.role === "user")?.text;
  return lastAsked && !turn.streaming ? () => void send(lastAsked) : undefined;
}

/** An example chip's words, put in a fresh message box (a new key) so it focuses with them. */
type Fill = { readonly text: string; readonly serial: number };

/** The chat itself, new (no chatId) or continuing a loaded conversation. */
export function ChatView({ client, chatId, initialMessages, initialDraft, idleMs }: ChatViewProps) {
  const turn = useChatTurn({ client, chatId, initialMessages });
  const send = useAnnouncedSend(turn.send);
  const mascotEvents = useChatMascot(turn.dispatchMascot, idleMs);
  const compact = useMediaQuery(MASCOT_COLUMN_HIDDEN, false);
  const [fill, setFill] = useState<Fill | null>(null);
  const caption = chatCaption(turn.mascot.mascot, latestReply(turn.messages), turn.mascot.backendDown);
  const empty = turn.messages.length === 0;
  const pick = useCallback((text: string) => setFill((prev) => ({ text, serial: (prev?.serial ?? 0) + 1 })), []);

  const auto = (size: "small" | "regular") => (
    <AutoMascot state={turn.mascot.mascot} onClipEnded={mascotEvents.onClipEnded} {...caption} size={size} />
  );

  return (
    <PageColumns mascot={compact || empty ? undefined : <MascotColumn>{auto("regular")}</MascotColumn>}>
      <PageHeader title={chatTitle(turn.messages)} />
      <div className={styles.chat}>
        {empty ? (
          <FirstOpenHero state={turn.mascot.mascot} onClipEnded={mascotEvents.onClipEnded} {...caption} />
        ) : (
          <MessageList messages={turn.messages} onRetry={retryLast(turn, send)} />
        )}
        <div className={styles.footer}>
          {compact && !empty && (
            <aside className={styles.mascotRow} aria-label="Auto">
              {auto("small")}
            </aside>
          )}
          {empty && <ExampleChips onPick={pick} />}
          <MessageBox
            key={fill ? `fill-${fill.serial}` : "box"}
            streaming={turn.streaming}
            onSend={send}
            onStop={turn.stop}
            onFocus={mascotEvents.onFocus}
            onBlur={mascotEvents.onBlur}
            initialDraft={fill?.text ?? initialDraft}
            autoFocus={empty || fill !== null}
          />
        </div>
      </div>
    </PageColumns>
  );
}
