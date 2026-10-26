'use client'

import type { MascotName } from '@automatos/mascot/types'
import { AutoMascot } from '../../mascot/auto-mascot'

import styles from './first-open.module.css'

/**
 * PRD-260 §4 — the empty chat (mock 06), ported from Automatos Play's
 * components/chat/FirstOpen.tsx: Auto big (playing hello on the first open in
 * a browser session), "Hi, I'm Auto." and three examples that fill the
 * message box. The empty chat draws no page header (play-chat-view.tsx), so the
 * headline is the page's h1. Play 1.2.0: while the host's voice session drives Auto (`voiceActive`), his caption
 * shows whatever his state, since the headline says nothing of the session, and his ring follows his voice while he
 * speaks.
 */

export const HELLO_TITLE = "Hi, I'm Auto."
export const HELLO_LINE = 'Your Automatos, the fun way'
export const EXAMPLES = [
  'Plan my revision week',
  'Write captions for our bake sale',
  'Budget a weekend in Lisbon',
] as const

/** The headline says these in words already; other states (a nap, a snag) keep their caption. */
const SAID_BY_HEADLINE: ReadonlySet<MascotName> = new Set<MascotName>(['hello', 'idle', 'listening'])

export interface FirstOpenHeroProps {
  readonly state: MascotName
  readonly onClipEnded: (state: MascotName) => void
  readonly caption?: string
  readonly detail?: string
  /** Auto speaks through the host's voice. */
  readonly speaking?: boolean
  /** A voice session drives Auto: his caption shows. */
  readonly voiceActive?: boolean
}

export function FirstOpenHero({ state, onClipEnded, caption, detail, speaking, voiceActive = false }: FirstOpenHeroProps) {
  return (
    <section className={styles.hero} aria-label="Say hello">
      <AutoMascot
        state={state}
        onClipEnded={onClipEnded}
        caption={caption}
        detail={detail}
        size="large"
        speaking={speaking}
        showCaption={voiceActive || !SAID_BY_HEADLINE.has(state)}
      />
      <h1 className={styles.title}>{HELLO_TITLE}</h1>
      <p className={styles.line}>{HELLO_LINE}</p>
    </section>
  )
}

export function ExampleChips({ onPick }: { readonly onPick: (text: string) => void }) {
  return (
    <ul className={styles.chips} aria-label="Examples to try">
      {EXAMPLES.map((example) => (
        <li key={example}>
          <button type="button" className={styles.chip} onClick={() => onPick(example)}>
            {example}
          </button>
        </li>
      ))}
    </ul>
  )
}
