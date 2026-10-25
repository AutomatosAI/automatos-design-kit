/**
 * PRD-261 B-02c: stand-ins for SDK cards HeaderUtilities, TrialExhaustedBanner and FirstRunNudge. They mirror core's
 * frontend/lib/theme-sdk/host-cards/chrome.tsx (101a0bf33f64fb4f89af81b4293415be60b661ac): the header's utilities
 * every frame renders (Help, notifications, the theme menu, the account; each click kept, none opens anything), the
 * banner once the workspace's credits are used up (the refused request's `credits_exhausted` code, or the host's
 * trial state, read through the fake context area), drawing nothing while work runs, and the local edition's
 * first-run nudge, drawing nothing in SaaS or once dismissed. Each drawn root carries data-protected-surface.
 *
 * The nudge has the geometry of core's components/local/first-run-nudge.tsx (chrome-styles.ts): a zero-height anchor
 * that takes no space, with its pill placed over the top of the chat column, core's words in it and the link to
 * Settings (a click kept, as the other cards keep theirs), in plain colours.
 */
import { type MouseEvent, type ReactElement, useState } from 'react'
import { recordCardAction } from '../../internal/scripted/cards-log.ts'
import { CREDITS_EXHAUSTED_CODE } from '../../internal/scripted/chat-turn.ts'
import { useEdition, useTrial } from '../../internal/scripted/host-inputs.ts'
import { CloseGlyph, KeyGlyph } from './chrome-glyphs.tsx'
import { NUDGE_ANCHOR, NUDGE_DISMISS, NUDGE_KEY_COLOR, NUDGE_LINK, NUDGE_PILL } from './chrome-styles.ts'

type Sdk = typeof import('@automatos/theme-sdk')

export const HEADER_UTILITIES_LABEL = 'Header utilities'
/** The utilities, in the Studio header's order (components/layout/studio-header.tsx). */
export const HEADER_UTILITIES: readonly string[] = Object.freeze(['Help', 'Notifications', 'Theme', 'Account'])
export const CREDITS_PAUSED_LINE = "Work on Automatos's AI keys is paused: the workspace's credits are used up. Add a key of your own to go on."
/** first-run-nudge.tsx:28-29 FIRST_RUN_NUDGE_MESSAGE, FIRST_RUN_NUDGE_LINK_LABEL and :27's href. */
export const NUDGE_LINE = 'Add an LLM key to bring Auto to life'
export const NUDGE_LINK_LABEL = 'Settings → API Keys'
export const NUDGE_SETTINGS_HREF = '/settings'
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

/** The link to Settings: the click is kept, and the harness stays where it is. */
function openSettings(event: MouseEvent<HTMLAnchorElement>): void {
  event.preventDefault()
  recordCardAction({ card: 'first-run-nudge', id: NUDGE_SETTINGS_HREF, action: 'opened' })
}

/** cards.FirstRunNudge: on the local edition only, until dismissed; a pill over the chat that takes no space. */
export const FirstRunNudge: Sdk['FirstRunNudge'] = function FirstRunNudge(): ReactElement {
  const edition = useEdition()
  const [dismissed, setDismissed] = useState(false)
  if (edition !== LOCAL_EDITION || dismissed) return <></>
  return (
    <div data-protected-surface="first-run-nudge" style={NUDGE_ANCHOR}>
      <div role="status" aria-live="polite" style={NUDGE_PILL}>
        <KeyGlyph color={NUDGE_KEY_COLOR} />
        <span>{NUDGE_LINE}</span>
        <a href={NUDGE_SETTINGS_HREF} style={NUDGE_LINK} onClick={openSettings}>
          {NUDGE_LINK_LABEL}
        </a>
        <button type="button" aria-label={DISMISS_LABEL} style={NUDGE_DISMISS} onClick={() => setDismissed(true)}>
          <CloseGlyph />
        </button>
      </div>
    </div>
  )
}
