/**
 * PRD-268 (SDK 1.3.0): the stand-in for SDK card `StatusLabel`. It mirrors core's
 * frontend/lib/theme-sdk/host-cards/proactive-cards.tsx StatusLabel over components/proactive/status-label.tsx (at
 * 1a8956c874dc42cff05b96f431c50b7d722a71aa): the props checked (a TypeError naming the prop), then a row's state as
 * its glyph and word (DISPLAY_STATE_LABELS; an unknown state draws nothing, never a placeholder), `▸` and its next
 * step, and Try again, named by the row's title, only when the row says what retry means and the theme can run it. Try
 * again's click stays on the button (the row around it may open on a click), and is kept (cardActions).
 */
import type { Retry } from '@automatos/theme-sdk'
import type { MouseEvent, ReactElement } from 'react'
import { displayStateLabel, NEXT_STEP_GLYPH } from '../../internal/proactive/labels.ts'
import { checkedRetry, handlerOf, optionalText } from '../../internal/proactive/props.ts'
import { recordCardAction } from '../../internal/scripted/cards-log.ts'
import { StatePill } from './proactive-parts.tsx'
import { LINE, SMALL_MUTED, TEXT_BUTTON } from './proactive-styles.ts'

type Sdk = typeof import('@automatos/theme-sdk')

export const TRY_AGAIN = 'Try again'
const CARD = 'StatusLabel'

interface LabelProps {
  readonly state: unknown
  readonly step: string | null | undefined
  readonly retry: Retry | null | undefined
  readonly run: ((retry: Retry) => void) | undefined
  readonly name: string | undefined
  readonly className?: string
}

/** status-label.tsx StatusLabel: nothing for a state that isn't one of DISPLAY_STATE_LABELS'. */
function Label({ state, step, retry, run, name, className }: LabelProps): ReactElement | null {
  const label = displayStateLabel(state)
  if (label === null) return null
  const press = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation()
    if (!retry) return
    recordCardAction({ card: 'status-label', id: name ?? String(state), action: retry })
    run?.(retry)
  }
  return (
    <span data-display-state={String(state)} className={className} style={LINE}>
      <StatePill label={label} />
      {step ? (
        <span style={SMALL_MUTED}>
          <span aria-hidden="true">{NEXT_STEP_GLYPH} </span>
          {step}
        </span>
      ) : null}
      {retry && run ? (
        <button type="button" aria-label={name ? `${TRY_AGAIN}: ${name}` : TRY_AGAIN} style={TEXT_BUTTON} onClick={press}>
          {TRY_AGAIN}
        </button>
      ) : null}
    </span>
  )
}

/** cards.StatusLabel: the props checked, then the glyph and the word, ▸ the next step, and Try again. */
export const StatusLabel: Sdk['StatusLabel'] = function StatusLabel({ state, nextStep, retry, onRetry, title, className }) {
  const step = optionalText(nextStep, CARD, 'nextStep')
  const checked = checkedRetry(retry)
  const run = handlerOf(onRetry, CARD, 'onRetry')
  const name = optionalText(title, CARD, 'title') ?? undefined
  return <Label state={state} step={step} retry={checked} run={run} name={name} className={className} />
}
