/**
 * The chrome stand-ins' geometry (src/sdk/cards/chrome.tsx), each taken from the core component it stands in for, in
 * plain colours of the harness's own (high contrast, so a stand-in never fails a theme's axe scan).
 *
 * The first-run nudge is core's frontend/components/local/first-run-nudge.tsx: a zero-height anchor (`relative z-30`,
 * inline `flex: 0 0 auto; height: 0`), so it takes no space from the chat, and on it an absolutely placed pill over the
 * top of the chat column (`absolute left-1/2 top-3 -translate-x-1/2`, `flex items-center gap-3 whitespace-nowrap`,
 * `max-w-[calc(100vw-2rem)] rounded-full border px-4 py-2 text-sm shadow-lg backdrop-blur`).
 *
 * The header utilities are core's components/layout/studio-header.tsx StudioHeaderUtilities on the local edition, as
 * globals.css's `.studio .sh-utils` draws it: a row 4 pixels apart of Help (`.sh-icon-btn`, 30 × 30), the
 * notifications bell (a ghost icon Button, 40 × 40, with its unread badge, 18 pixels high, over its top right corner),
 * a 1 × 18 separator, the theme menu (a ghost icon Button, 40 × 40) and the operator's profile link (a 36-pixel round
 * avatar and the name beside it).
 */
import type { CSSProperties } from 'react'

const PLAIN_FONT = 'system-ui, sans-serif'
const PLAIN_TEXT = '#18181b'
const PLAIN_MUTED = '#52525b'
const PLAIN_BORDER = '#d4d4d8'
/** Tailwind's shadow-lg. */
const SHADOW_LG = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)'

/** first-run-nudge.tsx:107: the zero-height anchor. */
export const NUDGE_ANCHOR: CSSProperties = Object.freeze({ position: 'relative', zIndex: 30, flex: '0 0 auto', height: '0px' })

/** first-run-nudge.tsx:109-112: the pill over the top of the chat column. */
export const NUDGE_PILL: CSSProperties = Object.freeze({
  position: 'absolute',
  left: '50%',
  top: '12px',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  whiteSpace: 'nowrap',
  maxWidth: 'calc(100vw - 2rem)',
  borderRadius: '9999px',
  border: `1px solid ${PLAIN_BORDER}`,
  background: 'rgba(255, 255, 255, 0.95)',
  color: PLAIN_TEXT,
  padding: '8px 16px',
  fontFamily: PLAIN_FONT,
  fontSize: '14px',
  lineHeight: '20px',
  boxShadow: SHADOW_LG,
  backdropFilter: 'blur(8px)',
})

/** The key's colour: an amber dark enough for its 3:1 on the pill. */
export const NUDGE_KEY_COLOR = '#a16207'

/** first-run-nudge.tsx:116-118: the link to Settings. */
export const NUDGE_LINK: CSSProperties = Object.freeze({ fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: '4px' })

/** first-run-nudge.tsx:125: the round dismiss button around its 16-pixel cross. */
export const NUDGE_DISMISS: CSSProperties = Object.freeze({
  display: 'inline-flex', borderRadius: '9999px', padding: '4px', color: PLAIN_MUTED, background: 'transparent', cursor: 'pointer',
})

/** globals.css `.studio .sh-utils`. */
export const UTILITIES: CSSProperties = Object.freeze({
  display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: PLAIN_FONT, color: PLAIN_MUTED,
})

const ICON_BUTTON: CSSProperties = Object.freeze({
  position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px',
  background: 'transparent', color: PLAIN_MUTED, cursor: 'pointer',
})

/** globals.css `.studio .sh-utils .sh-icon-btn`: Help. */
export const HELP_BUTTON: CSSProperties = Object.freeze({ ...ICON_BUTTON, width: '30px', height: '30px', border: '1px solid transparent' })

/** components/ui/button.tsx size `icon` (h-10 w-10): the bell and the theme menu. */
export const ICON_BUTTON_40: CSSProperties = Object.freeze({ ...ICON_BUTTON, width: '40px', height: '40px' })

/** notification-bell.tsx:247: the unread badge (`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px]`). */
export const BADGE: CSSProperties = Object.freeze({
  position: 'absolute', top: '-4px', right: '-4px', minWidth: '18px', height: '18px', padding: '0 4px', borderRadius: '9999px',
  background: PLAIN_TEXT, color: '#ffffff', fontSize: '10px', fontWeight: 600, lineHeight: '18px', textAlign: 'center',
})

/** globals.css `.studio .sh-utils .sh-sep`. */
export const SEPARATOR: CSSProperties = Object.freeze({ width: '1px', height: '18px', margin: '0 6px', background: PLAIN_BORDER })

/** user-profile-button.tsx:57 (LocalOperatorButton): `flex items-center gap-2 rounded-full pr-2`, the name `text-sm font-medium`. */
export const PROFILE_BUTTON: CSSProperties = Object.freeze({
  display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '9999px', paddingRight: '8px', background: 'transparent',
  color: PLAIN_TEXT, fontSize: '14px', lineHeight: '20px', fontWeight: 500, cursor: 'pointer',
})

/** user-profile-button.tsx:68: the initials' circle (`w-9 h-9 rounded-full text-xs font-semibold`). */
export const AVATAR: CSSProperties = Object.freeze({
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '9999px',
  background: PLAIN_TEXT, color: '#ffffff', fontSize: '12px', lineHeight: '16px', fontWeight: 600,
})
