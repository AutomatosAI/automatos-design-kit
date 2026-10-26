/**
 * PRD-261 B-02c: stand-ins for SDK cards HeaderUtilities, TrialExhaustedBanner and FirstRunNudge. They mirror core's
 * frontend/lib/theme-sdk/host-cards/chrome.tsx (101a0bf33f64fb4f89af81b4293415be60b661ac): the header's utilities
 * every frame renders (Help, notifications, the theme menu, the account; each click kept, none opens anything), the
 * banner once the workspace's credits are used up (the refused request's `credits_exhausted` code, or the host's
 * trial state, read through the fake context area), drawing nothing while work runs, and the local edition's
 * first-run nudge, drawing nothing in SaaS or once dismissed. Each drawn root carries data-protected-surface.
 *
 * The nudge has the geometry of core's components/local/first-run-nudge.tsx at 2c0bd3153 (chrome-styles.ts): a
 * zero-height anchor that takes no space, with its box placed over the top of the chat column, as wide as its words up
 * to the window, the words wrapping inside it on a phone, core's words in it and the link to Settings (a click kept, as
 * the other cards keep theirs), in plain colours; its corners are a full pill from Tailwind's `sm` (640 px) up, read
 * from the window's media query as core's class reads it (none in jsdom: the narrow corners). The utilities have the
 * geometry of core's cluster on the local edition: Help, the bell with a made-up unread count, a separator, the theme
 * menu and the account's avatar, each button named as HEADER_UTILITIES names it.
 */
import { type MouseEvent, type ReactElement, useState, useSyncExternalStore } from 'react'
import { recordCardAction } from '../../internal/scripted/cards-log.ts'
import { CREDITS_EXHAUSTED_CODE } from '../../internal/scripted/chat-turn.ts'
import { useEdition, useTrial } from '../../internal/scripted/host-inputs.ts'
import { BellGlyph, CloseGlyph, HelpGlyph, KeyGlyph, ToneGlyph } from './chrome-glyphs.tsx'
import {
  AVATAR, BADGE, HELP_BUTTON, ICON_BUTTON_40, NUDGE_ANCHOR, NUDGE_DISMISS, NUDGE_KEY_COLOR, NUDGE_LINK, NUDGE_MESSAGE, NUDGE_PILL,
  NUDGE_PILL_SM, NUDGE_SM_QUERY, PROFILE_BUTTON, SEPARATOR, UTILITIES,
} from './chrome-styles.ts'

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

/** The bell's made-up unread count. */
export const UNREAD_SAMPLE = 3
/** The local operator's initials on the account's avatar (made up). */
export const OPERATOR_INITIALS = 'OP'

const opened = (name: string) => (): void => recordCardAction({ card: 'header-utilities', id: name, action: 'opened' })

/** cards.HeaderUtilities: Help, notifications, the theme menu and the account, at the sizes core's cluster draws. */
export const HeaderUtilities: Sdk['HeaderUtilities'] = function HeaderUtilities() {
  const [help, notifications, theme, account] = HEADER_UTILITIES
  return (
    <div data-protected-surface="header-utilities" role="group" aria-label={HEADER_UTILITIES_LABEL} style={UTILITIES}>
      <button type="button" aria-label={help} style={HELP_BUTTON} onClick={opened(help)}>
        <HelpGlyph />
      </button>
      <button type="button" aria-label={notifications} style={ICON_BUTTON_40} onClick={opened(notifications)}>
        <BellGlyph />
        <span aria-hidden="true" data-harness-part="badge" style={BADGE}>{UNREAD_SAMPLE}</span>
      </button>
      <span aria-hidden="true" style={SEPARATOR} />
      <button type="button" aria-label={theme} style={ICON_BUTTON_40} onClick={opened(theme)}>
        <ToneGlyph />
      </button>
      <button type="button" style={PROFILE_BUTTON} onClick={opened(account)}>
        <span aria-hidden="true" data-harness-part="avatar" style={AVATAR}>{OPERATOR_INITIALS}</span>
        {account}
      </button>
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

const hasMatchMedia = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

function subscribeSm(onChange: () => void): () => void {
  if (!hasMatchMedia()) return () => undefined
  const query = window.matchMedia(NUDGE_SM_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const smNow = (): boolean => hasMatchMedia() && window.matchMedia(NUDGE_SM_QUERY).matches

/** True while the window is at least Tailwind's `sm` wide, as core's `sm:` classes ask; false with no matchMedia. */
function useSmUp(): boolean {
  return useSyncExternalStore(subscribeSm, smNow, () => false)
}

/** cards.FirstRunNudge: on the local edition only, until dismissed; a box over the chat that takes no space. */
export const FirstRunNudge: Sdk['FirstRunNudge'] = function FirstRunNudge(): ReactElement {
  const edition = useEdition()
  const smUp = useSmUp()
  const [dismissed, setDismissed] = useState(false)
  if (edition !== LOCAL_EDITION || dismissed) return <></>
  return (
    <div data-protected-surface="first-run-nudge" style={NUDGE_ANCHOR}>
      <div role="status" aria-live="polite" style={smUp ? NUDGE_PILL_SM : NUDGE_PILL}>
        <KeyGlyph color={NUDGE_KEY_COLOR} />
        <span style={NUDGE_MESSAGE}>{NUDGE_LINE}</span>
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
