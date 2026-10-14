// "What Auto did" (mocks 01 and 02): the platform's own account of the turn, one line
// per receipt. Receipt links point at Studio pages (cards, agents), so they aren't links here.

import { receiptLabel } from "@/lib/chat/labels";
import type { Receipt } from "@/lib/stream/types";

import styles from "./chat.module.css";

export const RECEIPTS_TITLE = "What Auto did";

function ReceiptItem({ receipt }: { readonly receipt: Receipt }) {
  const label = receiptLabel(receipt);
  return (
    <li className={styles.receipt} data-tone={label.tone}>
      <span className={styles.receiptLine}>
        <span className={styles.mark} aria-hidden="true">
          {label.mark}
        </span>
        <span>{label.text}</span>
        {label.badge && <span className={styles.badge}>{label.badge}</span>}
      </span>
      {label.reason && <span className={styles.receiptReason}>{label.reason}</span>}
    </li>
  );
}

export function Receipts({ receipts }: { readonly receipts: readonly Receipt[] }) {
  if (receipts.length === 0) return null;
  return (
    <section className={styles.receipts} aria-label={RECEIPTS_TITLE}>
      <h3 className={styles.receiptsTitle}>{RECEIPTS_TITLE}</h3>
      <ul className={styles.receiptList}>
        {receipts.map((receipt, index) => (
          // Receipts carry no id, and a turn's list never reorders.
          <ReceiptItem key={`${index}-${receipt.action}`} receipt={receipt} />
        ))}
      </ul>
    </section>
  );
}
