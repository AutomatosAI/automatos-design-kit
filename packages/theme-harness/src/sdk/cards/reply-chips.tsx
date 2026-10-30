/**
 * PRD-268 (SDK 1.3.0): the stand-in for SDK card `ReplyChips`. It mirrors core's
 * frontend/lib/theme-sdk/host-cards/proactive-cards.tsx ReplyChips over components/proactive/reply-chips.tsx (at
 * 1a8956c874dc42cff05b96f431c50b7d722a71aa): the props checked (a TypeError naming the prop), then the chips that can
 * be drawn (trimmed, non-empty, at most 24 characters, no repeats, the first three), nothing unless at least two are or
 * while the message is not Auto's last one (`latest` false). A tap hands the chip's own text to `onReply` once (kept as
 * a card action); the chips are held until a newer message takes them away, or given back when the send is refused.
 * Each chip is named "Reply: <chip>", its words Auto's.
 */
import { type ReactElement, useState } from 'react'
import { checkedChips, checkedFlag, requiredHandler } from '../../internal/proactive/props.ts'
import { recordCardAction } from '../../internal/scripted/cards-log.ts'
import { CHIP, LINE } from './proactive-styles.ts'

type Sdk = typeof import('@automatos/theme-sdk')

export const REPLY_CHIP_MAX_CHARS = 24
export const REPLY_CHIPS_MIN = 2
export const REPLY_CHIPS_MAX = 3
export const REPLIES_LABEL = 'Replies'
const REPLY_PREFIX = 'Reply: '
/** Joins a chip set into one key (a chip never holds this character). */
const SET_SEPARATOR = '\u0000'

/** reply-chips.tsx replyChipsOf. */
export function replyChipsOf(chips: readonly unknown[]): readonly string[] {
  const usable = chips
    .filter((chip): chip is string => typeof chip === 'string')
    .map((chip) => chip.trim())
    .filter((chip) => chip.length > 0 && [...chip].length <= REPLY_CHIP_MAX_CHARS)
  return [...new Set(usable)].slice(0, REPLY_CHIPS_MAX)
}

interface ChipsProps {
  readonly chips: readonly string[]
  readonly latest: boolean
  readonly onReply: (text: string) => void | Promise<unknown>
  readonly className?: string
}

function Chips({ chips, latest, onReply, className }: ChipsProps): ReactElement | null {
  const [sentFor, setSentFor] = useState<string | null>(null)
  const shown = replyChipsOf(chips)
  const setKey = shown.join(SET_SEPARATOR)
  const sent = sentFor === setKey
  if (!latest || shown.length < REPLY_CHIPS_MIN) return null
  const giveBack = (): void => setSentFor(null)
  const reply = (chip: string): void => {
    if (sent) return
    setSentFor(setKey)
    recordCardAction({ card: 'reply-chips', id: setKey, action: chip })
    try {
      Promise.resolve(onReply(chip)).catch(giveBack)
    } catch {
      giveBack()
    }
  }
  return (
    <div role="group" aria-label={REPLIES_LABEL} data-reply-chips="" className={className} style={LINE}>
      {shown.map((chip) => (
        <button key={chip} type="button" aria-label={`${REPLY_PREFIX}${chip}`} disabled={sent} style={CHIP} onClick={() => reply(chip)}>
          <span data-ai-generated="true">{chip}</span>
        </button>
      ))}
    </div>
  )
}

/** cards.ReplyChips: two or three answers under Auto's last message. */
export const ReplyChips: Sdk['ReplyChips'] = function ReplyChips({ chips, latest, onReply, className }) {
  const checked = checkedChips(chips)
  const isLatest = checkedFlag(latest, 'ReplyChips', 'latest')
  const reply = requiredHandler(onReply, 'ReplyChips', 'onReply')
  return <Chips chips={checked} latest={isLatest} onReply={reply} className={className} />
}
