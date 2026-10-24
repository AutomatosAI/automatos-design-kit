import { HostLink, type HostReceipt, movedSomethingOnTheBoard, receiptLine, receiptLink } from '@automatos/theme-sdk'

import { type LineTone, MARK_DONE, MARK_FAILED, MARK_MUTED, MARK_WAITING } from './labels'
import styles from './reply.module.css'

/**
 * "What Auto did", under his reply (after Play's receipts, themes/play/src/components/play/chat/receipts.tsx,
 * Play 1.1.1): the platform's own account of the turn, one line per call in the host's words (receiptLine), a done
 * call's page linked only when the host says it is a path in this app (receiptLink); a turn that ran nothing says
 * so, and so does one whose calls moved nothing on the board (the Studio chat's words). A reply from before
 * receipts shows nothing. Beside a line, its tag: Done for a done write, Not done for a refused call, Skipped for one
 * not run. The glyph and the tag carry the state, never the colour alone.
 */

export const RECEIPTS_TITLE = 'What Auto did'
export const BADGE_DONE = 'Done'
export const BADGE_NOT_DONE = 'Not done'
export const BADGE_SKIPPED = 'Skipped'
/** The Studio chat's closing notes, word for word. */
export const NO_ACTIONS = 'No actions in this turn.'
export const NOTHING_ON_THE_BOARD = 'No actions on the board.'

const LOOK: Readonly<Record<HostReceipt['status'], { readonly mark: string; readonly tone: LineTone }>> = {
  done: { mark: MARK_DONE, tone: 'done' },
  refused: { mark: MARK_FAILED, tone: 'failed' },
  skipped: { mark: MARK_MUTED, tone: 'muted' },
  waiting: { mark: MARK_WAITING, tone: 'waiting' },
}

/** The tag beside a receipt's line: a done read and a waiting ask have none (the line says "waiting for you"). */
export function receiptBadge(receipt: HostReceipt): string | null {
  if (receipt.status === 'refused') return BADGE_NOT_DONE
  if (receipt.status === 'skipped') return BADGE_SKIPPED
  return receipt.status === 'done' && receipt.kind === 'write' ? BADGE_DONE : null
}

function ReceiptItem({ receipt }: { readonly receipt: HostReceipt }) {
  const look = LOOK[receipt.status]
  const line = receiptLine(receipt)
  const link = receiptLink(receipt)
  const badge = receiptBadge(receipt)
  return (
    <li className={styles.receipt} data-tone={look.tone}>
      <span className={styles.mark} aria-hidden="true">
        {look.mark}
      </span>
      {link ? (
        <HostLink href={link} className={styles.receiptLink}>
          {line}
        </HostLink>
      ) : (
        <span>{line}</span>
      )}
      {badge && <span className={styles.badge}>{badge}</span>}
    </li>
  )
}

/** The closing note: nothing ran, or nothing moved on the board; none when a card moved. */
function noteFor(receipts: readonly HostReceipt[]): string | null {
  if (receipts.length === 0) return NO_ACTIONS
  return movedSomethingOnTheBoard(receipts) ? null : NOTHING_ON_THE_BOARD
}

export function Receipts({ receipts }: { readonly receipts: readonly HostReceipt[] | null }) {
  if (!receipts) return null
  const note = noteFor(receipts)
  return (
    <section className={styles.receipts} aria-label={RECEIPTS_TITLE}>
      <h3 className={styles.partTitle}>{RECEIPTS_TITLE}</h3>
      {receipts.length > 0 && (
        <ul className={styles.receiptList}>
          {receipts.map((receipt, index) => (
            // Receipts carry no id, and a turn's list never reorders.
            <ReceiptItem key={`${index}-${receipt.action}`} receipt={receipt} />
          ))}
        </ul>
      )}
      {note && <p className={styles.note}>{note}</p>}
    </section>
  )
}
