import type { ReactNode } from 'react'
import { MarkdownView } from '@automatos/theme-sdk'
import type { MascotName } from '@automatos/mascot/types'

import { AutoSprite } from '../art/pixel-art'
import { stateWord } from '../art/states'
import { CURSOR_TICKS, useTicks } from '../motion/clock'
import { type Saying, sayingId, wordsOf } from './saying'
import { type TextSpeed, useTypewriter } from './typewriter'
import chat from './chat.module.css'
import styles from './dialogue.module.css'
import ui from '../ui/ui.module.css'

/**
 * The dialogue window (the design's RPG dialogue box): Auto's portrait with his state in words, and what he says,
 * typing out at the look's text speed with a ▼ cursor; under it, the host strip with the message box and, on a
 * desktop, the host's voice button. The typed line is hidden from screen readers while it types; once whole it is
 * ordinary text, and the finished reply is said once through a polite live region. A reply that was there when the
 * chat opened shows whole and is not said again. Skip shows the rest at once.
 */

export const DIALOGUE_LABEL = 'Dialogue with Auto'
export const SPEAKER = 'Auto'
export const SKIP = 'Skip'
export const THINKING_LIVE = 'Auto is thinking'

/** Links in a line still typing are words, so no hidden link takes the focus. */
const PLAIN_LINKS = { a: ({ children }: { readonly children?: ReactNode }) => <span>{children}</span> }

function Words({ text, reply, plainLinks }: { readonly text: string; readonly reply: boolean; readonly plainLinks: boolean }) {
  if (!reply) return <p className={chat.plain}>{text}</p>
  return (
    <MarkdownView skipHtml density="compact" className={chat.markdown} components={plainLinks ? PLAIN_LINKS : undefined}>
      {text}
    </MarkdownView>
  )
}

interface SayProps {
  readonly saying: Saying
  readonly speed: TextSpeed
  readonly moving: boolean
  /** Replies already there when the chat opened. */
  readonly wholeIds: ReadonlySet<string>
}

function Say({ saying, speed, moving, wholeIds }: SayProps) {
  const id = sayingId(saying) ?? saying.kind
  const text = wordsOf(saying)
  const reply = saying.kind === 'reply' && text === saying.message.text
  const writing = saying.kind === 'reply' && saying.message.writing
  const typing = useTypewriter(id, text, { speed, moving, streaming: writing, whole: wholeIds.has(id) })
  const blink = useTicks(CURSOR_TICKS, moving && !typing.typing)
  const thinking = saying.kind === 'thinking'
  const announce = typing.done && !wholeIds.has(id) && saying.kind === 'reply'
  return (
    <div className={styles.say}>
      <div className={styles.typed} aria-hidden={typing.typing || thinking ? true : undefined} data-ai-generated={reply ? 'true' : undefined}>
        {thinking ? <p className={chat.plain}>…</p> : <Words text={text.slice(0, typing.shown)} reply={reply} plainLinks={typing.typing} />}
        {!thinking && (
          <span className={styles.cursor} aria-hidden="true" data-on={blink % 2 === 0 ? 'true' : 'false'}>
            ▼
          </span>
        )}
      </div>
      {typing.typing && (
        <button type="button" className={`${ui.secondary} ${styles.skip}`} onClick={typing.skip}>
          {SKIP}
        </button>
      )}
      <div className={ui.hidden} aria-live="polite">
        {thinking ? THINKING_LIVE : null}
        {announce ? <Words text={text} reply={reply} plainLinks /> : null}
      </div>
    </div>
  )
}

export interface DialogueProps extends SayProps {
  readonly portrait: MascotName
  readonly phone: boolean
  /** The host strip: the banner for used-up credits and the message box (with the voice button on a desktop). */
  readonly strip: ReactNode
}

export function Dialogue({ portrait, phone, strip, ...say }: DialogueProps) {
  return (
    <section className={`${ui.window} ${styles.dialogue}`} aria-label={DIALOGUE_LABEL} data-layout={phone ? 'phone' : undefined}>
      <h2 className={`${ui.label} ${styles.speakerTag}`}>{SPEAKER}</h2>
      <div className={styles.dialogueBody}>
        <div className={styles.portrait}>
          <div className={styles.portraitBox}>
            <AutoSprite state={portrait} view={phone ? 'phone' : 'portrait'} />
          </div>
          <p className={`${ui.label} ${styles.stateWord}`}>
            <span className={ui.hidden}>{`${SPEAKER}: `}</span>
            {stateWord(portrait)}
          </p>
        </div>
        <Say {...say} />
      </div>
      <div className={ui.host}>{strip}</div>
    </section>
  )
}
