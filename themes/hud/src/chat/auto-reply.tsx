import type { HostChatMessage } from '@automatos/theme-sdk'

import { ApprovalCards } from './approval-cards'
import { DeliverableCard } from './deliverable-card'
import { HudMarkdown } from './markdown'
import { Receipts } from './receipts'
import { replyDeliverables } from './reply'
import { ReplyCards } from './reply-cards'
import styles from './reply.module.css'
import { SnagBox } from './snag-box'
import { ToolLines } from './tool-lines'
import rows from './transcript.module.css'

/**
 * One reply from Auto, an AUTO row of the transcript (after Play's, themes/play/src/components/play/chat/
 * auto-reply.tsx, Play 1.1.1), top to bottom: who wrote it when the turn didn't ("Auto · background"), the lines
 * the platform puts above the answer (a refused write, work not done), what he said while he worked, his tool
 * lines, the answer as Markdown with the design's blinking block cursor while it streams, the Deliverables the turn
 * made, the approvals it raised (the host's cards), the host's withdraw offer and ticket cards, what he did (the
 * receipts), a limit reached, then a failure: in the snag box once the turn is over, as a plain line while he
 * answers. A failed turn the server saved is that failure, never an answer. A reply you stopped keeps what it had
 * and says so last.
 *
 * The row's root carries data-ai-generated="true", the machine-readable mark the host puts on every assistant
 * message of its own chat (the EU AI Act's Article 50(2)), while it streams and once it is done.
 */

export const SPEAKER = 'Auto'
/** Under a reply you stopped. */
export const STOPPED_NOTICE = 'You stopped this answer.'

function Lines({ lines, className }: { readonly lines: readonly string[]; readonly className: string }) {
  return (
    <>
      {lines.map((line, index) => (
        // Plain lines with no id; a reply only ever appends them.
        <p key={`${index}-${line}`} className={className}>
          {line}
        </p>
      ))}
    </>
  )
}

function Answer({ text, streaming }: { readonly text: string; readonly streaming: boolean }) {
  if (!text && !streaming) return null
  return (
    <div className={styles.answer}>
      {text && <HudMarkdown text={text} />}
      {streaming && <span className={styles.cursor} data-hud-loop="" aria-hidden="true" />}
    </div>
  )
}

interface FailureProps {
  readonly message: string | null
  readonly streaming: boolean
  readonly onRetry?: () => void
  readonly hidden: boolean
}

/** The turn's failure in words: the snag box once it is over, a line while Auto still answers. */
function Failure({ message, streaming, onRetry, hidden }: FailureProps) {
  if (!message || hidden) return null
  if (!streaming) return <SnagBox lines={[message]} onRetry={onRetry} />
  return (
    <p className={styles.error}>
      <span className={styles.mark} aria-hidden="true">
        ✕
      </span>
      {message}
    </p>
  )
}

export interface AutoReplyProps {
  /** The reply: its Deliverables, its approval cards and whether Stop ended it come with it. */
  readonly message: HostChatMessage
  /** This reply is the one being written now. */
  readonly streaming: boolean
  /** Try again on this reply's snag box: only the newest reply gets it. */
  readonly onRetry?: () => void
  /** Used-up credits blocked this turn: the host's banner says so instead of the snag box. */
  readonly snagHidden?: boolean
  /** The newest exchange, set at the design's large sizes. */
  readonly recent?: boolean
}

export function AutoReply({ message, streaming, onRetry, snagHidden = false, recent = false }: AutoReplyProps) {
  const { provenance, savedError, limitReached } = message
  return (
    <article
      className={rows.row}
      aria-label={`${SPEAKER} said`}
      aria-busy={streaming}
      data-ai-generated="true"
      data-speaker="auto"
      data-recent={recent ? 'true' : undefined}
    >
      <h2 className={rows.speaker}>{SPEAKER}</h2>
      <div className={styles.body}>
        <Lines lines={provenance ? [provenance] : []} className={styles.notice} />
        <Lines lines={message.above} className={styles.above} />
        <Lines lines={message.activity} className={styles.activity} />
        <ToolLines calls={message.toolCalls} streaming={streaming} />
        {savedError === null && <Answer text={message.text} streaming={streaming} />}
        {replyDeliverables(message).map((deliverable) => (
          <DeliverableCard key={deliverable.id} deliverable={deliverable} />
        ))}
        <ApprovalCards approvals={message.approvals} />
        <ReplyCards message={message} />
        <Receipts receipts={message.receipts} />
        <Lines lines={limitReached ? [limitReached] : []} className={styles.notice} />
        <Failure message={message.error?.message ?? savedError} streaming={streaming} onRetry={onRetry} hidden={snagHidden} />
        {message.stopped && <p className={styles.notice}>{STOPPED_NOTICE}</p>}
      </div>
    </article>
  )
}
