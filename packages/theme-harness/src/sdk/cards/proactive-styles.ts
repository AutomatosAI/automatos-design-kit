/**
 * The proactive card stand-ins' geometry (src/sdk/cards/brief-card.tsx and the others), from core's
 * frontend/components/proactive/card-parts.tsx and status-label.tsx (at 1a8956c874dc42cff05b96f431c50b7d722a71aa),
 * whose classes are Studio's tokens: flat paper, a 1 px border, 12 px corners, one ink primary, quiet bordered
 * controls, the studio-eyebrow label and the studio-pill status. Here they are inline styles over the same custom
 * properties, so a theme's look paints them in the harness as it paints core's. Each token has a plain fallback for a
 * page that sets none. A status pill is painted by its role's token on the ground's tone, never by `--accent`.
 */
import type { CSSProperties } from 'react'
import type { StatusRole } from '@automatos/theme-sdk'
import { STATUS_ROLE_TOKENS } from '../../internal/proactive/labels.ts'

const FALLBACK: Readonly<Record<string, string>> = Object.freeze({
  '--card': '0 0% 100%', '--card-foreground': '0 0% 9%', '--border': '0 0% 80%', '--foreground': '0 0% 9%',
  '--muted-foreground': '0 0% 35%', '--muted': '0 0% 94%', '--primary': '0 0% 9%', '--primary-foreground': '0 0% 98%',
  '--destructive': '0 72% 40%', '--warn-ink': '30 80% 28%', '--warning': '38 92% 50%', '--running': '40 20% 36%',
  '--success': '142 60% 28%', '--info': '215 60% 35%',
})

/** `hsl(var(--name, fallback))`. */
export function token(name: string): string {
  return `hsl(var(${name}, ${FALLBACK[name] ?? FALLBACK['--foreground']}))`
}

/** card-parts.tsx CARD_CLASS: `rounded-xl border border-border bg-card p-4 text-card-foreground`. */
export const CARD: CSSProperties = Object.freeze({
  display: 'flex', flexDirection: 'column', gap: '12px', borderRadius: '12px', border: `1px solid ${token('--border')}`,
  background: token('--card'), color: token('--card-foreground'), padding: '16px', fontSize: '14px', lineHeight: '20px',
})

/** suggestion-card.tsx PinnedLine: one bordered line. */
export const PINNED: CSSProperties = Object.freeze({
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', borderRadius: '12px', border: `1px solid ${token('--border')}`,
  background: token('--card'), color: token('--card-foreground'), padding: '8px 12px', fontSize: '14px',
})

/** card-parts.tsx EYEBROW_CLASS: mono, 11 px, semibold, upper case, tracked, muted. */
export const EYEBROW: CSSProperties = Object.freeze({
  margin: 0, fontFamily: 'var(--font-geist-mono), ui-monospace, monospace', fontSize: '11px', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.08em', color: token('--muted-foreground'),
})

/** brief-card.tsx GREETING_CLASS: the only serif in the proactive components. */
export const GREETING: CSSProperties = Object.freeze({
  margin: 0, fontSize: '24px', fontWeight: 500, lineHeight: 1.15, color: token('--foreground'),
  fontFamily: 'var(--font-newsreader), ui-serif, serif',
})

export const MUTED: CSSProperties = Object.freeze({ margin: 0, color: token('--muted-foreground') })
export const SMALL_MUTED: CSSProperties = Object.freeze({ margin: 0, fontSize: '12px', color: token('--muted-foreground') })
export const TITLE: CSSProperties = Object.freeze({ margin: 0, fontWeight: 500, color: token('--foreground') })
export const ROW: CSSProperties = Object.freeze({ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '8px 0' })
export const LIST: CSSProperties = Object.freeze({ listStyle: 'none', margin: 0, padding: 0 })
export const LINE: CSSProperties = Object.freeze({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' })
export const ALERT: CSSProperties = Object.freeze({ margin: 0, color: token('--destructive') })
/** card-parts.tsx AiCaption: the tiny "Auto is an AI" caption, never a pill. */
export const CAPTION: CSSProperties = Object.freeze({ fontSize: '11px', fontWeight: 500, lineHeight: '16px', color: token('--muted-foreground') })

const BUTTON: CSSProperties = Object.freeze({
  display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '12px', padding: '6px 12px', fontSize: '14px', cursor: 'pointer',
})
/** card-parts.tsx PRIMARY_BUTTON_CLASS: the view's one ink primary. */
export const PRIMARY_BUTTON: CSSProperties = Object.freeze({
  ...BUTTON, fontWeight: 500, border: '1px solid transparent', background: token('--primary'), color: token('--primary-foreground'),
})
/** card-parts.tsx QUIET_BUTTON_CLASS: every other control. */
export const QUIET_BUTTON: CSSProperties = Object.freeze({
  ...BUTTON, border: `1px solid ${token('--border')}`, background: 'transparent', color: token('--foreground'),
})
/** card-parts.tsx TEXT_BUTTON_CLASS: a control drawn as text ("Start →", "Show 3 more"). */
export const TEXT_BUTTON: CSSProperties = Object.freeze({
  border: 0, background: 'transparent', padding: 0, fontSize: '14px', fontWeight: 500, color: token('--foreground'), cursor: 'pointer',
})
/** reply-chips.tsx CHIP_CLASS. */
export const CHIP: CSSProperties = Object.freeze({ ...QUIET_BUTTON, background: token('--card'), padding: '4px 12px' })

/** status-label.tsx StatePill in Studio: `studio-pill`, bordered, no fill, in the role's token for the ground's tone. */
export function pillStyle(role: StatusRole, dark: boolean): CSSProperties {
  const tokens = STATUS_ROLE_TOKENS[role]
  return {
    display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '999px', border: `1px solid ${token('--border')}`,
    background: 'transparent', padding: '0 8px', fontSize: '12px', lineHeight: '20px', color: token(dark ? tokens.dark : tokens.light),
  }
}
