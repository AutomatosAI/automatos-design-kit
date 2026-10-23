/**
 * PRD-261 B-02c: stand-ins for SDK cards HeaderUtilities, TrialExhaustedBanner and FirstRunNudge. They mirror core's
 * frontend/lib/theme-sdk/host-cards/chrome.tsx (101a0bf33f64fb4f89af81b4293415be60b661ac): the header's utilities
 * every frame renders (Help, notifications, the theme menu, the account; each click kept, none opens anything), the
 * banner once the workspace's credits are used up (the refused request's `credits_exhausted` code, or the host's
 * trial state, read through the fake context area), drawing nothing while work runs, and the local edition's
 * first-run nudge, drawing nothing in SaaS or once dismissed. Each drawn root carries data-protected-surface.
 */
import { type ReactElement, useState } from 'react'
import { recordCardAction } from '../../internal/scripted/cards-log.ts'
import { CREDITS_EXHAUSTED_CODE } from '../../internal/scripted/chat-turn.ts'
import { useEdition, useTrial } from '../../internal/scripted/host-inputs.ts'

type Sdk = typeof import('@automatos/theme-sdk')

export const HEADER_UTILITIES_LABEL = 'Header utilities'
/** The utilities, in the Studio header's order (components/layout/studio-header.tsx). */
export const HEADER_UTILITIES: readonly string[] = Object.freeze(['Help', 'Notifications', 'Theme', 'Account'])
export const CREDITS_PAUSED_LINE = "Work on Automatos's AI keys is paused: the workspace's credits are used up. Add a key of your own to go on."
export const NUDGE_LABEL = 'Get started'
export const NUDGE_LINE = 'Add an LLM key to start chatting.'
export const DISMISS_LABEL = 'Dismiss'
const EXHAUSTED_TRIAL = 'exhausted'
const LOCAL_EDITION = 'local'

/** cards.HeaderUtilities: Help, notifications, the theme menu and the account. */
export const HeaderUtilities: Sdk['HeaderUtilities'] = function HeaderUtilities() {
  return (
    <div data-protected-surface="header-utilities" role="group" aria-label={HEADER_UTILITIES_LABEL}>
      {HEADER_UTILITIES.map((name) => (
        <button key={name} type="button" onClick={() => recordCardAction({ card: 'header-utilities', id: name, action: 'opened' })}>
          {name}
        </button>
      ))}
    </div>
  )
}

/** cards.TrialExhaustedBanner: shown once credits are used up (the request's code, or the trial's state). */
export const TrialExhaustedBanner: Sdk['TrialExhaustedBanner'] = function TrialExhaustedBanner({ errorCode }): ReactElement {
  const trial = useTrial()
  const paused = errorCode === CREDITS_EXHAUSTED_CODE || trial?.state === EXHAUSTED_TRIAL
  if (!paused) return <></>
  return (
    <div data-protected-surface="trial-exhausted-banner" role="alert">
      {CREDITS_PAUSED_LINE}
    </div>
  )
}

/** cards.FirstRunNudge: on the local edition only, until dismissed. */
export const FirstRunNudge: Sdk['FirstRunNudge'] = function FirstRunNudge(): ReactElement {
  const edition = useEdition()
  const [dismissed, setDismissed] = useState(false)
  if (edition !== LOCAL_EDITION || dismissed) return <></>
  return (
    <aside data-protected-surface="first-run-nudge" aria-label={NUDGE_LABEL}>
      <p>{NUDGE_LINE}</p>
      <button type="button" onClick={() => setDismissed(true)}>
        {DISMISS_LABEL}
      </button>
    </aside>
  )
}
