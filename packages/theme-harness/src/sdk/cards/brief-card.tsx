/**
 * PRD-268 (SDK 1.3.0): the stand-in for SDK card `BriefCard`. It mirrors core's
 * frontend/lib/theme-sdk/host-cards/proactive-cards.tsx BriefCard over components/proactive/brief-card.tsx (at
 * 1a8956c874dc42cff05b96f431c50b7d722a71aa): the props checked (the brief read as the host reads one, a TypeError
 * naming the prop), then the date, the greeting (the only serif), Auto's Read (the prose, inside the card), the five
 * sections (brief-sections.tsx), the tiny "Auto is an AI" caption once, Listen (the voice area's BriefVoice, which
 * reads the brief the host holds, never this prop; left out with `listen` false) and the thumbs. Auto's words carry
 * data-ai-generated and the controls sit outside them. A row the theme gets back is a frozen copy. A thumb is kept
 * (cardActions, by the brief's state_hash) where core posts it to the digest feedback route.
 */
import type { BriefRow, BriefSection } from '@automatos/theme-sdk'
import { type ReactElement, useMemo, useState } from 'react'
import { frozenCopy } from '../../internal/page-views.ts'
import { checkedBrief, checkedFlag, handlerOf } from '../../internal/proactive/props.ts'
import { recordCardAction } from '../../internal/scripted/cards-log.ts'
import { BriefVoice } from '../brief-voice.tsx'
import { BriefSections } from './brief-sections.tsx'
import { AiCaption, Eyebrow } from './proactive-parts.tsx'
import { CARD, GREETING, LINE, MUTED, TEXT_BUTTON } from './proactive-styles.ts'

type Sdk = typeof import('@automatos/theme-sdk')

const CARD_NAME = 'BriefCard'
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
/** brief-card.tsx BriefThumbs: the group's name and each thumb's. */
export const RATE_LABEL = 'Rate this brief'
export const THUMBS = Object.freeze({ helpful: 'Helpful', notHelpful: 'Not helpful' })
type Rating = keyof typeof THUMBS

/** brief-card.tsx briefDateLabel: the brief's local date as the browser says a day; the text as it is otherwise. */
export function briefDateLabel(date: string): string {
  const parts = DATE.exec(date)
  if (!parts) return date
  const day = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
  return Number.isNaN(day.getTime()) ? date : day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

/** brief-card.tsx BriefThumbs: one rating per card, by the brief's state_hash; none without one. */
function Thumbs({ stateHash }: { readonly stateHash: string }): ReactElement {
  const [rated, setRated] = useState<Rating | null>(null)
  const rate = (rating: Rating): void => {
    if (rated !== null || !stateHash) return
    recordCardAction({ card: 'brief-card', id: stateHash, action: rating })
    setRated(rating)
  }
  const thumb = (rating: Rating, glyph: string): ReactElement => (
    <button
      type="button" aria-label={THUMBS[rating]} aria-pressed={rated === rating} disabled={rated !== null || !stateHash} style={TEXT_BUTTON}
      onClick={() => rate(rating)}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  )
  return <div role="group" aria-label={RATE_LABEL} style={LINE}>{thumb('helpful', '+')}{thumb('notHelpful', '−')}</div>
}

/** cards.BriefCard: the date, the greeting, Auto's Read, the sections, the caption, Listen and the thumbs. */
export const BriefCard: Sdk['BriefCard'] = function BriefCard({ brief, listen = true, onAction, onOpen, onShowMore, className }) {
  const shown = useMemo(() => checkedBrief(brief), [brief])
  const action = handlerOf(onAction, CARD_NAME, 'onAction')
  const open = handlerOf(onOpen, CARD_NAME, 'onOpen')
  const more = handlerOf(onShowMore, CARD_NAME, 'onShowMore')
  const withListen = checkedFlag(listen, CARD_NAME, 'listen')
  return (
    <article aria-label={shown.greeting} data-brief-date={shown.date} className={className} style={CARD}>
      <header>
        <Eyebrow><time dateTime={shown.date}>{briefDateLabel(shown.date)}</time></Eyebrow>
        <h2 data-studio-serif="" data-ai-generated="true" style={GREETING}>{shown.greeting}</h2>
      </header>
      {shown.prose ? <p data-ai-generated="true" data-brief-prose="" style={{ ...MUTED, whiteSpace: 'pre-line' }}>{shown.prose}</p> : null}
      <BriefSections
        brief={shown}
        onAction={action && ((row: BriefRow, section: BriefSection) => action(frozenCopy(row), section))}
        onOpen={open && ((row: BriefRow, section: BriefSection) => open(frozenCopy(row), section))}
        onShowMore={more}
      />
      <footer style={{ ...LINE, justifyContent: 'space-between' }}>
        <AiCaption />
        <div style={LINE}>
          {withListen ? <div data-brief-listen=""><BriefVoice /></div> : null}
          <Thumbs stateHash={shown.state_hash} />
        </div>
      </footer>
    </article>
  )
}
