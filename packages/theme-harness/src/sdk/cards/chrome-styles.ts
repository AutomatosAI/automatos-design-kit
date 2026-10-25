/**
 * The chrome stand-ins' geometry (src/sdk/cards/chrome.tsx), each taken from the core component it stands in for, in
 * plain colours of the harness's own (high contrast, so a stand-in never fails a theme's axe scan).
 *
 * The first-run nudge is core's frontend/components/local/first-run-nudge.tsx: a zero-height anchor (`relative z-30`,
 * inline `flex: 0 0 auto; height: 0`), so it takes no space from the chat, and on it an absolutely placed pill over the
 * top of the chat column (`absolute left-1/2 top-3 -translate-x-1/2`, `flex items-center gap-3 whitespace-nowrap`,
 * `max-w-[calc(100vw-2rem)] rounded-full border px-4 py-2 text-sm shadow-lg backdrop-blur`).
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
