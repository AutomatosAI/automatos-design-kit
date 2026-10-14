"use client";

// A saved conversation: loads its messages, then hands them to the chat to continue.
// While it loads Auto shows "Loading"; when it can't, he says so and offers a retry.

import Link from "next/link";

import { AutoMascot } from "@/components/mascot/AutoMascot";
import { MascotColumn, PageColumns, PageHeader } from "@/components/shell/PageColumns";
import { type StoredConversation, useStoredConversation } from "@/hooks/useStoredConversation";
import { api, type ApiClient } from "@/lib/client/api";

import { ChatView } from "./ChatView";
import styles from "./opening.module.css";

export const OPENING = "Opening this conversation…";

export interface StoredChatProps {
  readonly client?: ApiClient;
  readonly chatId: string;
}

export function StoredChat({ client = api, chatId }: StoredChatProps) {
  const conversation = useStoredConversation(client, chatId);
  if (conversation.status === "ready") {
    return <ChatView client={client} chatId={chatId} initialMessages={conversation.value} />;
  }
  return <Opening conversation={conversation} />;
}

type NotReady = Exclude<StoredConversation, { readonly status: "ready" }>;

function Opening({ conversation }: { readonly conversation: NotReady }) {
  return (
    <PageColumns
      mascot={
        <MascotColumn>
          <AutoMascot state={conversation.status === "failed" ? "oops" : "loading"} />
        </MascotColumn>
      }
    >
      <PageHeader title="Conversation" />
      <div className={styles.opening}>
        {conversation.status === "failed" ? (
          <Failed error={conversation.error} retry={conversation.retry} />
        ) : (
          <p className={styles.status} role="status">
            {OPENING}
          </p>
        )}
      </div>
    </PageColumns>
  );
}

function Failed({ error, retry }: { readonly error: string; readonly retry: () => void }) {
  return (
    <div className={styles.failed} role="alert">
      <p className={styles.error}>
        <span aria-hidden="true">✕</span> {error}
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.retry} onClick={retry}>
          Try again
        </button>
        <Link href="/" className={styles.secondary}>
          Start a new chat
        </Link>
      </div>
    </div>
  );
}
