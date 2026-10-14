// The grouped list (mock 03): Today, This week, Earlier; each row is the title, the
// time and the last line, and opens the conversation in the chat.

import Link from "next/link";
import { useId } from "react";

import { chatHref } from "@/lib/chat/params";
import type { ChatSummary } from "@/lib/client/types";
import {
  type ConversationGroup,
  conversationTitle,
  groupConversations,
  lastActive,
  previewLine,
  relativeTime,
} from "@/lib/conversations/list";

import styles from "./conversations.module.css";

export interface ConversationListProps {
  readonly chats: readonly ChatSummary[];
  readonly now: Date;
}

export function ConversationList({ chats, now }: ConversationListProps) {
  return groupConversations(chats, now).map((group) => <Group key={group.label} group={group} now={now} />);
}

function Group({ group, now }: { readonly group: ConversationGroup; readonly now: Date }) {
  const headingId = useId();
  return (
    <section className={styles.group} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.groupLabel}>
        {group.label}
      </h2>
      <ul className={styles.list}>
        {group.chats.map((chat) => (
          <li key={chat.id}>
            <Row chat={chat} now={now} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Row({ chat, now }: { readonly chat: ChatSummary; readonly now: Date }) {
  const active = lastActive(chat);
  const preview = previewLine(chat);
  return (
    <Link href={chatHref(chat.id)} className={styles.row}>
      <span className={styles.rowTop}>
        <span className={styles.rowTitle}>{conversationTitle(chat)}</span>
        {active && (
          <time className={styles.time} dateTime={active.toISOString()}>
            {relativeTime(active, now)}
          </time>
        )}
      </span>
      {preview && <span className={styles.preview}>{preview}</span>}
    </Link>
  );
}
