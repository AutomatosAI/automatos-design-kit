// The "I hit a snag" box (mock 08): what went wrong, in words, and Try again, which
// sends your message again. Only the newest reply gets the button.

import { SNAG_TITLE } from "@/lib/chat/snag";

import styles from "./chat.module.css";

export interface SnagBoxProps {
  readonly lines: readonly string[];
  /** Sends the message again; none for an older reply. */
  readonly onRetry?: () => void;
}

export function SnagBox({ lines, onRetry }: SnagBoxProps) {
  return (
    <section className={styles.snag} aria-label={SNAG_TITLE}>
      <h3 className={styles.snagTitle}>{SNAG_TITLE}</h3>
      {lines.map((line, index) => (
        <p key={`${index}-${line}`} className={styles.error}>
          <span className={styles.mark} aria-hidden="true">
            ✕
          </span>
          {line}
        </p>
      ))}
      {onRetry && (
        <div className={styles.snagActions}>
          <button type="button" className={styles.snagRetry} onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
    </section>
  );
}
