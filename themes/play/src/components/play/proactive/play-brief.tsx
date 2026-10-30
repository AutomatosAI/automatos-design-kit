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
 */

/** The brief's region. */
export const BRIEF_LABEL = "Today's brief"

export function PlayBrief({ brief }: { readonly brief: Brief }) {
  const onAction = useBriefAction()
  return (
    <section className={styles.brief} aria-label={BRIEF_LABEL}>
      <BriefCard brief={brief} onAction={onAction} />
    </section>
  )
}

export interface BriefReplyProps {
  /** The brief's message: its words are the brief's prose, which the card shows, so they are not drawn again. */
  readonly message: HostChatMessage
  readonly brief: Brief
}

/** The brief's message in a conversation: Auto's label, who wrote it ("Auto · background"), then the card. */
export function BriefReply({ message, brief }: BriefReplyProps) {
  return (
    <article className={chat.reply} aria-label={`${SPEAKER} said`}>
      <h2 className={chat.speaker}>{SPEAKER}</h2>
      {message.provenance ? <p className={chat.notice}>{message.provenance}</p> : null}
      <PlayBrief brief={brief} />
    </article>
  )
}
