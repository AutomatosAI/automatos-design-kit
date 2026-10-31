'use client'

import { type Brief, BriefCard, type HostChatMessage } from '@automatos/theme-sdk'

import { useBriefAction } from '../../../hooks/use-brief-action'
import { SPEAKER } from '../chat/auto-reply'
import chat from '../chat/chat.module.css'
import styles from './proactive.module.css'

/**
 * Play 1.3.0 (PRD-268 §6.11.2, §6.12.4) — the day's brief in Play's chat, as the host's own card (cards.BriefCard): the
 * date, the greeting, Auto's Read, the five sections with their counts and "Show N more", the empty sentence, the "Auto
 * is an AI" caption, Listen (the host's BriefVoice, which reads the brief in Auto's voice; Play never speaks) and the
 * thumbs. The card marks Auto's words (the greeting, the prose, every row) data-ai-generated and keeps its controls
 * outside them, so Play adds no mark of its own around it. A row's action (Start, Open, Answer, Set up) runs through
 * useBriefAction. The copy is the brief's own: the server's labels and the SDK's defaults.
 *
 * Two places: on an empty chat in the first open's place (opening-cards.tsx), and in a conversation as the brief's own
 * message (BriefReply, in message-list.tsx), so it scrolls with the conversation like any reply.
 *
 * Play 1.4.0 (SDK 1.4.0): in a conversation the card draws from the message's own `brief@1` part, so an earlier day's
 * brief in the Auto thread is a card too, its rows and counts that day's. The host's Listen reads the day's brief the
 * host holds, so only that day's card offers it (`today`); an earlier day's card has none, as it would read today's,
 * and its region is named as an earlier brief.
 */

/** The day's brief's region. */
export const BRIEF_LABEL = "Today's brief"
/** An earlier day's brief's region, in the Auto thread. */
export const EARLIER_BRIEF_LABEL = 'An earlier brief'

export interface PlayBriefProps {
  readonly brief: Brief
  /** It is the day's brief the host holds: named so, with Listen (the host's BriefVoice). Default true. */
  readonly today?: boolean
}

export function PlayBrief({ brief, today = true }: PlayBriefProps) {
  const onAction = useBriefAction()
  return (
    <section className={styles.brief} aria-label={today ? BRIEF_LABEL : EARLIER_BRIEF_LABEL}>
      <BriefCard brief={brief} listen={today} onAction={onAction} />
    </section>
  )
}

export interface BriefReplyProps {
  /** The brief's message: its words are the brief's prose, which the card shows, so they are not drawn again. */
  readonly message: HostChatMessage
  /** The brief its `brief@1` part carries. */
  readonly brief: Brief
  /** It is the day's brief the host holds: the card offers Listen. */
  readonly today: boolean
}

/** The brief's message in a conversation: Auto's label, who wrote it ("Auto · background"), then the card. */
export function BriefReply({ message, brief, today }: BriefReplyProps) {
  return (
    <article className={chat.reply} aria-label={`${SPEAKER} said`}>
      <h2 className={chat.speaker}>{SPEAKER}</h2>
      {message.provenance ? <p className={chat.notice}>{message.provenance}</p> : null}
      <PlayBrief brief={brief} today={today} />
    </article>
  )
}
