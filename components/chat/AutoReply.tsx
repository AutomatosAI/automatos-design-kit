// One reply from Auto (mocks 01 and 02), top to bottom: the "Auto" label, the lines the
// platform puts above the answer, narration and progress, the tool lines, the answer as
// markdown, the Deliverables he made, the receipts, then notices and errors in words:
// in the snag box (mock 08) once the turn is over, as plain lines while he answers or
// after you stopped him.

import { snagLines } from "@/lib/chat/snag";
import type { AutoMessage } from "@/lib/chat/types";

import { DeliverableCard } from "./DeliverableCard";
import { Markdown } from "./Markdown";
import { Receipts } from "./Receipts";
import { SnagBox } from "./SnagBox";
import { ToolLines } from "./ToolLines";
import styles from "./chat.module.css";

export const SPEAKER = "Auto";

function Lines({ lines, className }: { readonly lines: readonly string[]; readonly className: string }) {
  return lines.map((line, index) => (
    // Plain lines with no id; a reply only ever appends them.
    <p key={`${index}-${line}`} className={className}>
      {line}
    </p>
  ));
}

function Answer({ message }: { readonly message: AutoMessage }) {
  const streaming = message.status === "streaming";
  if (!message.text && !streaming) return null;
  return (
    <div className={styles.answer}>
      {message.text && <Markdown text={message.text} />}
      {streaming && <span className={styles.cursor} aria-hidden="true" />}
    </div>
  );
}

function Errors({ errors }: { readonly errors: readonly string[] }) {
  return errors.map((error, index) => (
    <p key={`${index}-${error}`} className={styles.error}>
      <span className={styles.mark} aria-hidden="true">
        ✕
      </span>
      {error}
    </p>
  ));
}

export interface AutoReplyProps {
  readonly message: AutoMessage;
  /** Sends the message before this reply again (the snag box's Try again). */
  readonly onRetry?: () => void;
}

export function AutoReply({ message, onRetry }: AutoReplyProps) {
  const snag = snagLines(message);
  return (
    <article className={styles.reply} aria-label={`${SPEAKER} said`} aria-busy={message.status === "streaming"}>
      <h2 className={styles.speaker}>{SPEAKER}</h2>
      <Lines lines={message.above} className={styles.above} />
      <Lines lines={message.activity.map((line) => line.text)} className={styles.activity} />
      <ToolLines tools={message.tools} />
      <Answer message={message} />
      {message.deliverables.map((deliverable) => (
        <DeliverableCard key={deliverable.id} deliverable={deliverable} />
      ))}
      <Receipts receipts={message.receipts} />
      {message.missionSuggestion && (
        <p className={styles.activity}>Auto suggests a Mission: {message.missionSuggestion.goal}</p>
      )}
      <Lines lines={message.notices} className={styles.notice} />
      {snag.length > 0 ? <SnagBox lines={snag} onRetry={onRetry} /> : <Errors errors={message.errors} />}
      {message.status === "stopped" && <p className={styles.notice}>You stopped this answer.</p>}
    </article>
  );
}
