import type { ReactNode } from 'react'
import { type HostChatMessage, type HostDeliverable, HostLink, MarkdownView } from '@automatos/theme-sdk'

import { ItemIcon } from '../art/pixel-art'
import { deliverableHref, isDeliverableId } from '../deliverables/links'
import { Choices, ReplyCards } from './cards'
import { eventLines, itemKindOf, KIND_WORDS } from './lines'
import { replyDeliverables } from './reply'
import styles from './chat.module.css'
import ui from '../ui/ui.module.css'

/**
 * The story's entries (the design's story window): YOU for your lines, AUTO for Auto's, ★ for what a reply did, an
 * ITEM RECEIVED window for each Deliverable it made, and the host's approval cards under "! A CHOICE AWAITS". A
 * reply's words are the host's Markdown, drawn by the host's sanitising renderer with raw HTML dropped. The reply the
 * dialogue box is saying keeps its words there; the story shows the rest of it.
 */

export const YOU = 'You'
export const AUTO = 'Auto'
export const ITEM_RECEIVED = 'Item received!'
export const OPEN = 'Open'
export const MADE_HERE = 'made in this chat'
export const STOPPED = 'You stopped this answer.'
export const TRY_AGAIN = 'Try again'

interface LineProps {
  readonly mark: string
  readonly tone: 'you' | 'auto' | 'event' | 'notice' | 'failed'
  /** The mark is a speaker a screen reader hears; a glyph is decoration. */
  readonly spoken?: boolean
  readonly children: ReactNode
}

export function Line({ mark, tone, spoken = false, children }: LineProps) {
  return (
    <div className={styles.line} data-tone={tone}>
      <span className={styles.mark} aria-hidden={spoken ? undefined : true}>
        {mark}
      </span>
      <div className={styles.lineText}>{children}</div>
    </div>
  )
}

export function YouLine({ message }: { readonly message: HostChatMessage }) {
  return (
    <article className={styles.entry} aria-label={`${YOU} said`}>
      <Line mark={YOU} tone="you">
        <p className={styles.plain}>{message.text}</p>
      </Line>
    </article>
  )
}

export function ReplyWords({ text }: { readonly text: string }) {
  return (
    <MarkdownView skipHtml density="compact" className={styles.markdown}>
      {text}
    </MarkdownView>
  )
}

export function ItemReceived({ deliverable }: { readonly deliverable: HostDeliverable }) {
  const linkable = isDeliverableId(deliverable.id)
  return (
    <div className={`${ui.window} ${styles.item}`} data-ground="page" role="group" aria-label={`${ITEM_RECEIVED} ${deliverable.title}`}>
      <ItemIcon kind={itemKindOf(deliverable)} />
      <div className={styles.itemText}>
        <span className={`${ui.label} ${styles.itemLabel}`}>{ITEM_RECEIVED}</span>
        <span className={styles.itemTitle}>{deliverable.title}</span>
        <span className={styles.itemMeta}>{`${KIND_WORDS[deliverable.kind]} · ${MADE_HERE}`}</span>
      </div>
      {linkable && (
        <HostLink href={deliverableHref(deliverable.id)} className={ui.button} aria-label={`${OPEN} ${deliverable.title}`}>
          {OPEN}
        </HostLink>
      )}
    </div>
  )
}

function Lines({ lines, mark, tone }: { readonly lines: readonly string[]; readonly mark: string; readonly tone: LineProps['tone'] }) {
  return (
    <>
      {lines.map((line, index) => (
        <Line key={`${index}-${line}`} mark={mark} tone={tone}>
          <p className={styles.plain}>{line}</p>
        </Line>
      ))}
    </>
  )
}

function Events({ message }: { readonly message: HostChatMessage }) {
  return (
    <>
      {eventLines(message).map((line) => (
        <Line key={line.key} mark={line.tone === 'failed' ? '✕' : '★'} tone={line.tone}>
          {line.href ? <HostLink href={line.href} className={styles.eventLink}>{line.text}</HostLink> : <p className={styles.plain}>{line.text}</p>}
        </Line>
      ))}
    </>
  )
}

export interface AutoEntryProps {
  readonly message: HostChatMessage
  /** Show the reply's words here (false for the reply the dialogue box is saying). */
  readonly words: boolean
  /** Try again on this reply's failure: the newest reply only. */
  readonly onRetry?: () => void
  /** Used-up credits blocked this turn: the host's banner says so instead. */
  readonly failureHidden?: boolean
}

function Failure({ message, onRetry }: { readonly message: string; readonly onRetry?: () => void }) {
  return (
    <Line mark="✕" tone="failed">
      <p className={styles.plain}>{message}</p>
      {onRetry && (
        <button type="button" className={ui.secondary} onClick={onRetry}>
          {TRY_AGAIN}
        </button>
      )}
    </Line>
  )
}

export function AutoEntry({ message, words, onRetry, failureHidden = false }: AutoEntryProps) {
  const failure = message.error?.message ?? message.savedError
  const showWords = words && message.savedError === null && message.text.trim().length > 0
  return (
    <article className={styles.entry} aria-label={`${AUTO} said`} data-ai-generated="true">
      <Lines lines={message.provenance ? [message.provenance] : []} mark="★" tone="event" />
      <Lines lines={message.above} mark="!" tone="notice" />
      <Lines lines={message.activity} mark="★" tone="event" />
      <Events message={message} />
      {showWords && (
        <Line mark={AUTO} tone="auto">
          <ReplyWords text={message.text} />
        </Line>
      )}
      {replyDeliverables(message).map((deliverable) => (
        <ItemReceived key={deliverable.id} deliverable={deliverable} />
      ))}
      <Choices approvals={message.approvals} />
      <ReplyCards message={message} />
      <Lines lines={message.limitReached ? [message.limitReached] : []} mark="!" tone="notice" />
      {failure && !failureHidden && !message.writing ? <Failure message={failure} onRetry={onRetry} /> : null}
      <Lines lines={message.stopped ? [STOPPED] : []} mark="!" tone="notice" />
    </article>
  )
}
