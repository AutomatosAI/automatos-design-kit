// The conversation: your bubbles on the right, Auto's replies on the left (mock 01).
// It keeps the newest line in view while Auto answers.

import { useEffect, useRef } from "react";

import type { ChatMessage } from "@/lib/chat/types";
import type { Mission } from "@/lib/missions/types";

import { AutoReply } from "./AutoReply";
import styles from "./chat.module.css";

/** How close to the bottom counts as "reading the newest line". */
const FOLLOW_SLACK_PX = 120;

function nearBottom(): boolean {
  const page = document.scrollingElement ?? document.documentElement;
  return page.scrollHeight - page.scrollTop - page.clientHeight <= FOLLOW_SLACK_PX;
}

/**
 * Follows the conversation as it grows, unless you scrolled up to read; a new message
 * (you just sent one) follows again. jsdom has no scrollIntoView, hence the check.
 */
function useFollow(messages: readonly ChatMessage[]) {
  const endRef = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const count = messages.length;

  useEffect(() => {
    const onScroll = () => {
      following.current = nearBottom();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    following.current = true;
  }, [count]);

  useEffect(() => {
    const end = endRef.current;
    if (following.current && end && typeof end.scrollIntoView === "function") end.scrollIntoView({ block: "end" });
  }, [messages]);

  return endRef;
}

export interface MessageListProps {
  readonly messages: readonly ChatMessage[];
  /** Try again on the newest reply's snag box: sends your last message again. */
  readonly onRetry?: () => void;
  /** Starts the Mission the reply with this id suggests. */
  readonly onStartMission?: (replyId: string) => Promise<Mission>;
}

export function MessageList({ messages, onRetry, onStartMission }: MessageListProps) {
  const endRef = useFollow(messages);
  const newest = messages.at(-1)?.id;
  return (
    <div className={styles.messages}>
      <ol className={styles.messageList} aria-label="Conversation">
        {messages.map((message) => (
          <li key={message.id} className={message.role === "user" ? styles.userItem : styles.replyItem}>
            {message.role === "user" ? (
              <p className={styles.bubble}>{message.text}</p>
            ) : (
              <AutoReply
                message={message}
                onRetry={message.id === newest ? onRetry : undefined}
                onStartMission={onStartMission && (() => onStartMission(message.id))}
              />
            )}
          </li>
        ))}
      </ol>
      <div ref={endRef} />
    </div>
  );
}
