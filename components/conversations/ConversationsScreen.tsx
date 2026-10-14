"use client";

// Conversations (mock 03): every earlier chat, grouped by day, with a search on the
// title and a New chat button. Opening one continues it in the chat (/?chat=<id>).
// Auto idles in the mascot column on wide screens; the phone list has no mascot.

import Link from "next/link";
import { type ChangeEvent, useState } from "react";

import { AutoMascot } from "@/components/mascot/AutoMascot";
import { MascotColumn, PageColumns } from "@/components/shell/PageColumns";
import { useConversations } from "@/hooks/useConversations";
import type { Loaded } from "@/hooks/useLoad";
import { api, type ApiClient } from "@/lib/client/api";
import type { ChatSummary } from "@/lib/client/types";
import { filterByTitle } from "@/lib/conversations/list";

import { ConversationList } from "./ConversationList";
import styles from "./conversations.module.css";

export const SEARCH_LABEL = "Search conversations";
export const LOADING_LIST = "Loading your conversations…";
export const NO_CONVERSATIONS = "No conversations yet. Say hello to Auto and your first one starts.";

export interface ConversationsScreenProps {
  /** Tests pass their own (createApiClient with a mock fetch). */
  readonly client?: ApiClient;
  /** What "today" is; tests pin it. */
  readonly now?: Date;
}

export function ConversationsScreen({ client = api, now }: ConversationsScreenProps) {
  const list = useConversations(client);
  const [query, setQuery] = useState("");
  const onSearch = (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value);

  return (
    <PageColumns
      mascot={
        <MascotColumn>
          <AutoMascot state="idle" />
        </MascotColumn>
      }
    >
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Conversations</h1>
          <Link href="/" className={styles.newChat}>
            New chat
          </Link>
        </div>
        <input
          type="search"
          className={styles.search}
          aria-label={SEARCH_LABEL}
          placeholder={SEARCH_LABEL}
          value={query}
          onChange={onSearch}
        />
        <ListBody list={list} query={query} now={now ?? new Date()} />
      </div>
    </PageColumns>
  );
}

interface ListBodyProps {
  readonly list: Loaded<readonly ChatSummary[]>;
  readonly query: string;
  readonly now: Date;
}

function ListBody({ list, query, now }: ListBodyProps) {
  if (list.status === "loading") {
    return (
      <p className={styles.status} role="status">
        {LOADING_LIST}
      </p>
    );
  }
  if (list.status === "failed") {
    return (
      <div className={styles.failed} role="alert">
        <p className={styles.error}>
          <span aria-hidden="true">✕</span> {list.error}
        </p>
        <button type="button" className={styles.retry} onClick={list.retry}>
          Try again
        </button>
      </div>
    );
  }
  if (list.value.length === 0) return <p className={styles.status}>{NO_CONVERSATIONS}</p>;
  const shown = filterByTitle(list.value, query);
  if (shown.length === 0) {
    return <p className={styles.status}>No conversation titles match “{query.trim()}”.</p>;
  }
  return <ConversationList chats={shown} now={now} />;
}
