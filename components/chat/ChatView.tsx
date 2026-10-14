"use client";

// The chat with Auto (mocks 01 and 02). useChatTurn sends and streams; this screen lays
// out the conversation, the message box and Auto: in the mascot column on wide screens,
// and as a small row above the message box where that column is hidden (phones, and
// tablets below 1024 px). ChatScreen picks a new chat or a saved one (StoredChat).

import { useCallback } from "react";

import { AutoMascot } from "@/components/mascot/AutoMascot";
import { MascotColumn, PageColumns, PageHeader } from "@/components/shell/PageColumns";
import { useChatTurn } from "@/hooks/useChatTurn";
import { useMediaQuery } from "@/hooks/useMediaPreferences";
import { chatCaption, latestReply } from "@/lib/chat/caption";
import type { ChatMessage } from "@/lib/chat/types";
import type { ApiClient } from "@/lib/client/api";
import { announceChatsChanged } from "@/lib/client/chat-events";
import type { MascotName } from "@/lib/mascot/types";

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
}

/** The conversation's name: its first message (the messages route doesn't carry the backend's title). */
export function chatTitle(messages: readonly ChatMessage[]): string {
  const first = messages.find((message) => message.role === "user")?.text.replace(/\s+/g, " ").trim();
  if (!first) return NEW_CHAT;
  return first.length <= TITLE_CHARS ? first : `${first.slice(0, TITLE_CHARS - 1).trimEnd()}…`;
}

/** The chat itself, new (no chatId) or continuing a loaded conversation. */
export function ChatView({ client, chatId, initialMessages, initialDraft }: ChatViewProps) {
  const turn = useChatTurn({ client, chatId, initialMessages });
  const { dispatchMascot, send: sendTurn } = turn;
  const compact = useMediaQuery(MASCOT_COLUMN_HIDDEN, false);
  const caption = chatCaption(turn.mascot.mascot, latestReply(turn.messages));

  const onClipEnded = useCallback((state: MascotName) => dispatchMascot({ type: "clip-ended", state }), [dispatchMascot]);
  const onFocus = useCallback(() => dispatchMascot({ type: "input-focus" }), [dispatchMascot]);
  const onBlur = useCallback(() => dispatchMascot({ type: "input-blur" }), [dispatchMascot]);
  // A turn that went out moved its conversation to the top of the history (or made it).
  const send = useCallback(
    async (text: string): Promise<boolean> => {
      const sent = await sendTurn(text);
      if (sent) announceChatsChanged();
      return sent;
    },
    [sendTurn],
  );

  const auto = (size: "small" | "regular") => (
    <AutoMascot
      state={turn.mascot.mascot}
      onClipEnded={onClipEnded}
      caption={caption.caption}
      detail={caption.detail}
      size={size}
    />
  );

  return (
    <PageColumns mascot={compact ? undefined : <MascotColumn>{auto("regular")}</MascotColumn>}>
      <PageHeader title={chatTitle(turn.messages)} />
      <div className={styles.chat}>
        <MessageList messages={turn.messages} />
        <div className={styles.footer}>
          {compact && (
            <aside className={styles.mascotRow} aria-label="Auto">
              {auto("small")}
            </aside>
          )}
          <MessageBox
            streaming={turn.streaming}
            onSend={send}
            onStop={turn.stop}
            onFocus={onFocus}
            onBlur={onBlur}
            initialDraft={initialDraft}
          />
        </div>
      </div>
    </PageColumns>
  );
}
