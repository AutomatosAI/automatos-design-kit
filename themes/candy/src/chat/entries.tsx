// After themes/arcade/src/chat/entries.tsx (Arcade 1.0.0): the same reply parts, drawn as Candy's bubbles and chips.
import { Fragment } from 'react'
import { type HostChatMessage, type HostDeliverable, HostLink, MarkdownView } from '@automatos/theme-sdk'
import type { MascotName } from '@automatos/mascot/types'

import { Auto } from '../art/auto'
import { Choices, ReplyCards } from './cards'
import { deliverableHref, isDeliverableId } from './links'
import { CHIP_GLYPHS, deliverableSet, KIND_WORDS, toolChipsOf, type ToolChip } from './lines'
import { replyDeliverables } from './reply'
import styles from './thread.module.css'
import ui from '../ui/ui.module.css'

/**
 * The thread's entries (the design's W2 thread): your words in a bubble on the right, in the accent's gradient;
 * Auto's on the left beside his face, on the chip colour, with what the reply did as chips over it (✓ done, ● still
 * running, ✕ failed), a row for each Deliverable it made with Open, the host's approval cards under it, and the lines
 * a reply can end on (a cap, a failure with Try again, a stop). A reply's words are the host's Markdown, drawn by the
 * host's sanitising renderer with raw HTML dropped. While Auto has no words yet, "Auto is writing" stands in for them.
 */

export const YOU_SAID = 'You said'
export const AUTO_SAID = 'Auto said'
export const WRITING = 'Auto is writing'
export const OPEN = 'Open'
export const MADE_HERE = 'made in this chat'
export const DELIVERABLE_LABEL = 'Deliverable:'
export const STOPPED = 'You stopped this answer.'
export const TRY_AGAIN = 'Try again'
/** Auto's initial on the faces of his older replies. */
const AUTO_INITIAL = 'A'
/** Auto's face beside each reply, in px. */
const FACE_SIZE = 44

/** Your words as you typed them, each line of them on its own line. */
export function UserBubble({ message }: { readonly message: HostChatMessage }) {
  const lines = message.text.split('\n')
  return (
    <article className={styles.you} aria-label={YOU_SAID}>
      <p className={styles.userBubble}>
        {lines.map((line, index) => (
          <Fragment key={index}>
            {index > 0 && <br />}
            {line}
          </Fragment>
        ))}
      </p>
    </article>
  )
}

/** Auto beside a reply: his still figure by the newest, a gradient circle with his initial by the older ones. */
export function AutoFace({ state }: { readonly state: MascotName | null }) {
  if (state === null) {
    return (
      <span className={`${ui.avatar} ${styles.face}`} data-set="2" aria-hidden="true">
        {AUTO_INITIAL}
      </span>
    )
  }
  return (
    <span className={styles.face}>
      <Auto state={state} size={FACE_SIZE} still />
    </span>
  )
}

/** "Auto is writing": three dots in the cards' colours that bounce only while things may move. */
export function WritingChip({ moving }: { readonly moving: boolean }) {
  return (
    <p className={styles.writing} data-moving={moving ? 'true' : undefined}>
      <span className={styles.dots} aria-hidden="true">
        <span className={styles.dot} data-set="1" />
        <span className={styles.dot} data-set="2" />
        <span className={styles.dot} data-set="3" />
      </span>
      {WRITING}
    </p>
  )
}

export function ReplyWords({ text }: { readonly text: string }) {
  return (
    <MarkdownView skipHtml density="compact" className={styles.markdown}>
      {text}
    </MarkdownView>
  )
}

export function DeliverableRow({ deliverable }: { readonly deliverable: HostDeliverable }) {
  const linkable = isDeliverableId(deliverable.id)
  return (
    <div className={styles.made} role="group" aria-label={`${DELIVERABLE_LABEL} ${deliverable.title}`}>
      <span className={styles.thumb} data-set={deliverableSet(deliverable)} aria-hidden="true">
        <span className={styles.thumbDot} />
      </span>
      <span className={styles.madeText}>
        <span className={styles.madeTitle}>{deliverable.title}</span>
        <span className={styles.madeMeta}>{`${KIND_WORDS[deliverable.kind]} · ${MADE_HERE}`}</span>
      </span>
      {linkable && (
        <HostLink href={deliverableHref(deliverable.id)} className={`${ui.link} ${styles.open}`} aria-label={`${OPEN} ${deliverable.title}`}>
          {OPEN}
        </HostLink>
      )}
    </div>
  )
}

function Chip({ chip }: { readonly chip: ToolChip }) {
  const glyph = <span aria-hidden="true">{CHIP_GLYPHS[chip.tone]}</span>
  if (chip.href) {
    return (
      <HostLink href={chip.href} className={`${styles.chip} ${styles.chipLink}`} data-tone={chip.tone}>
        {glyph} {chip.text}
      </HostLink>
    )
  }
  return (
    <span className={styles.chip} data-tone={chip.tone}>
      {glyph} {chip.text}
    </span>
  )
}

/** What the reply did, and the notices the platform puts above it ("!"), as chips in a row. */
function Chips({ message }: { readonly message: HostChatMessage }) {
  const chips = toolChipsOf(message)
  if (chips.length === 0 && message.above.length === 0) return null
  return (
    <div className={styles.chips}>
      {message.above.map((line, index) => (
        <span key={`above-${index}`} className={styles.chip} data-tone="notice">
          <span aria-hidden="true">!</span> {line}
        </span>
      ))}
      {chips.map((chip) => (
        <Chip key={chip.key} chip={chip} />
      ))}
    </div>
  )
}

/** Quiet lines: who wrote a reply the turn didn't, and a long tool's progress. */
function Notes({ lines }: { readonly lines: readonly string[] }) {
  return (
    <>
      {lines.map((line, index) => (
        <p key={`${index}-${line}`} className={styles.note}>
          {line}
        </p>
      ))}
    </>
  )
}

function Failure({ message, onRetry }: { readonly message: string; readonly onRetry?: () => void }) {
  return (
    <div className={styles.failure}>
      <span className={styles.chip} data-tone="failed">
        <span aria-hidden="true">{CHIP_GLYPHS.failed}</span> {message}
      </span>
      {onRetry && (
        <button type="button" className={`${ui.quiet} ${ui.small}`} onClick={onRetry}>
          {TRY_AGAIN}
        </button>
      )}
    </div>
  )
}

export interface AutoEntryProps {
  readonly message: HostChatMessage
  /** Auto's state for the newest reply's face; null for an older reply. */
  readonly face: MascotName | null
  /** Things may move: the writing dots bounce. */
  readonly moving: boolean
  /** Try again on this reply's failure: the newest reply only. */
  readonly onRetry?: () => void
  /** Used-up credits blocked this turn: the host's banner says so instead. */
  readonly failureHidden?: boolean
}

/** The reply's words, or "Auto is writing" while it is being written and has none yet. */
function Words({ message, moving }: { readonly message: HostChatMessage; readonly moving: boolean }) {
  const hasText = message.text.trim().length > 0
  if (!hasText) return message.writing ? <WritingChip moving={moving} /> : null
  if (message.savedError !== null) return null
  return (
    <div className={styles.autoBubble}>
      <ReplyWords text={message.text} />
    </div>
  )
}

export function AutoEntry({ message, face, moving, onRetry, failureHidden = false }: AutoEntryProps) {
  const failure = message.error?.message ?? message.savedError
  return (
    <article className={styles.auto} aria-label={AUTO_SAID} data-ai-generated="true">
      <AutoFace state={face} />
      <div className={styles.autoColumn}>
        <Notes lines={message.provenance ? [message.provenance] : []} />
        <Chips message={message} />
        <Notes lines={message.activity} />
        <Words message={message} moving={moving} />
        {replyDeliverables(message).map((deliverable) => (
          <DeliverableRow key={deliverable.id} deliverable={deliverable} />
        ))}
        <Choices approvals={message.approvals} />
        <ReplyCards message={message} />
        {message.limitReached ? (
          <span className={styles.chip} data-tone="notice">
            <span aria-hidden="true">!</span> {message.limitReached}
          </span>
        ) : null}
        {failure && !failureHidden && !message.writing ? <Failure message={failure} onRetry={onRetry} /> : null}
        {message.stopped ? <p className={styles.note}>{STOPPED}</p> : null}
      </div>
    </article>
  )
}
