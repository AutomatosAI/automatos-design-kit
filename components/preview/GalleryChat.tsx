// Studio's chat ledger, drawn: the user's message, Auto's tool lines (running, done, failed, as
// Studio's activity trail shows them), Auto's answer, the receipts box ("What I did"), a
// Deliverable card and the composer.

import {
  AUTO_ANSWER,
  COMPOSER,
  DELIVERABLE,
  RECEIPTS,
  RECEIPTS_TITLE,
  TOOL_LINES,
  TOOL_STATE_WORDS,
  USER_MESSAGE,
  type ToolState,
} from "./content";
import styles from "./chat.module.css";

const TOOL_GLYPHS: Readonly<Record<ToolState, string>> = { running: "◌", done: "✓", failed: "✕" };

function ToolLines() {
  return (
    <ol className={styles.trail} aria-label="Activity">
      {TOOL_LINES.map((line) => (
        <li key={line.text} className={styles.toolLine} data-state={line.state}>
          <span className={styles.toolGlyph} aria-hidden="true">
            {TOOL_GLYPHS[line.state]}
          </span>
          <span className={styles.toolText}>
            <span className={styles.hidden}>{TOOL_STATE_WORDS[line.state]}: </span>
            {line.text}
          </span>
          {line.detail && <span className={styles.toolDetail}>· {line.detail}</span>}
        </li>
      ))}
    </ol>
  );
}

function Receipts() {
  return (
    <div className={styles.receipts}>
      <p className={styles.receiptsTitle}>{RECEIPTS_TITLE}</p>
      <ol className={styles.receiptList} aria-label={RECEIPTS_TITLE}>
        {RECEIPTS.map((receipt) => (
          <li key={receipt.text} className={styles.receipt} data-ok={receipt.ok ? "yes" : "no"}>
            <span className={styles.receiptGlyph} aria-hidden="true">
              {receipt.ok ? "✓" : "✕"}
            </span>
            <span className={styles.hidden}>{receipt.ok ? "Done" : "Refused"}: </span>
            {receipt.text}
          </li>
        ))}
      </ol>
    </div>
  );
}

function DeliverableCard() {
  return (
    <div className={styles.deliverable}>
      <span className={styles.deliverableTile} aria-hidden="true" />
      <span className={styles.deliverableText}>
        <span className={styles.deliverableTitle}>{DELIVERABLE.title}</span>
        <span className={styles.deliverableMeta}>{DELIVERABLE.meta}</span>
      </span>
      <span className={styles.deliverableAction}>{DELIVERABLE.action}</span>
    </div>
  );
}

export function GalleryChat() {
  return (
    <div className={styles.ledger}>
      <p className={styles.userMessage}>{USER_MESSAGE}</p>
      <div className={styles.autoTurn}>
        <p className={styles.speaker}>Auto</p>
        <ToolLines />
        <p className={styles.answer}>{AUTO_ANSWER}</p>
        <Receipts />
        <DeliverableCard />
      </div>
      <div className={styles.composer}>
        <span className={styles.composerField}>{COMPOSER.placeholder}</span>
        <span className={styles.send}>{COMPOSER.send}</span>
      </div>
    </div>
  );
}
