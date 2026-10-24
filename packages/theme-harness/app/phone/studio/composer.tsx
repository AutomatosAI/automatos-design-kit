/**
 * The composer (the app's src/chat/composer/Composer.tsx :91-:127 and PillInput.tsx :24-:65): on the card ground with
 * a 1 pt rule over it, the [+] (an outline 42 pt button), the 'Message Auto' pill (42 tall, a 21 pt radius, the page's
 * ground and a 1 pt border, the ring and its 3 pt glow at 18 % while focused; the thread's 16/24 words) and the round
 * 42 pt ink button, which sends only once there are words (half its opacity until then). Typing stays in the pill:
 * nothing is sent anywhere.
 */
import { tint } from '@automatos/theme-cli/phone'
import { useState, type CSSProperties } from 'react'
import { typeStyle } from '../../../src/phone/type.ts'
import { APP_COPY } from './copy.ts'
import { painted, pressHandlers, useGoPaint, usePress } from './paint.tsx'
import { Icon, RADII, SPACE } from './primitives.tsx'

/** composer-state.ts PILL_INPUT (:94-:100), ICON_BUTTON_SIZES.lg (variants.ts :176-:182) and FOCUS_RING (:329). */
const PILL = Object.freeze({ minHeight: 42, border: 1, paddingX: 16 })
const ROUND_BUTTON = Object.freeze({ box: 42, icon: 18 })
const FOCUS_RING = Object.freeze({ width: 3, alpha: 0.18 })
const DISABLED_OPACITY = 0.5
/** The custom property the pill's placeholder reads (a placeholder takes no inline colour). */
export const PLACEHOLDER_VAR = '--go-placeholder'
export const PLACEHOLDER_CSS = `[data-go-part="pillInput"]::placeholder { color: var(${PLACEHOLDER_VAR}); opacity: 1; }`

type PillStyle = CSSProperties & { readonly '--go-placeholder': string }

const BUTTON_BASE: CSSProperties = Object.freeze({
  width: ROUND_BUTTON.box, height: ROUND_BUTTON.box, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderWidth: 1, borderStyle: 'solid', padding: 0, cursor: 'pointer', appearance: 'none',
})

function AttachButton() {
  const paint = useGoPaint()
  const press = usePress()
  const part = painted(paint, 'attachButton', { ...BUTTON_BASE, borderRadius: RADII.control }, press.pressed ? 'pressed' : 'rest')
  return (
    <button type="button" aria-label={APP_COPY.attach} {...pressHandlers(press)} {...part}>
      <Icon name="plus" size={ROUND_BUTTON.icon} />
    </button>
  )
}

function PillInput({ value, onChange }: { readonly value: string; readonly onChange: (text: string) => void }) {
  const paint = useGoPaint()
  const [focused, setFocused] = useState(false)
  const face = typeStyle('thread', paint.fonts)
  const line = Number.parseFloat(face.lineHeight)
  const layout: PillStyle = {
    ...face, flex: 1, minWidth: 0, boxSizing: 'border-box', resize: 'none', outline: 'none', margin: 0,
    minHeight: PILL.minHeight, height: PILL.minHeight, borderRadius: PILL.minHeight / 2, borderWidth: PILL.border, borderStyle: 'solid',
    padding: `${Math.max(0, (PILL.minHeight - 2 * PILL.border - line) / 2)}px ${PILL.paddingX}px`,
    boxShadow: focused ? `0 0 0 ${FOCUS_RING.width}px ${tint(paint.colours.ring, FOCUS_RING.alpha)}` : 'none',
    '--go-placeholder': paint.colours.mutedForeground,
  }
  return (
    <textarea
      rows={1}
      value={value}
      aria-label={APP_COPY.placeholder}
      placeholder={APP_COPY.placeholder}
      onChange={(event) => onChange(event.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...painted(paint, 'pillInput', layout, focused ? 'focused' : 'rest')}
    />
  )
}

function SendButton({ ready }: { readonly ready: boolean }) {
  const paint = useGoPaint()
  const part = painted(paint, 'sendButton', { ...BUTTON_BASE, borderRadius: RADII.full, opacity: ready ? 1 : DISABLED_OPACITY })
  return (
    <button type="button" aria-label={APP_COPY.send} disabled={!ready} {...part}>
      <Icon name="arrow-up" size={ROUND_BUTTON.icon} />
    </button>
  )
}

/** The strip: the row of [+], the pill and the send button. */
export function Composer() {
  const paint = useGoPaint()
  const [text, setText] = useState('')
  const layout: CSSProperties = {
    borderTopWidth: 1, borderTopStyle: 'solid', padding: `${SPACE.s4}px ${SPACE.s5}px`, display: 'flex', flexDirection: 'column',
    gap: SPACE.s3, flexShrink: 0,
  }
  return (
    <div {...painted(paint, 'composer', layout)}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: SPACE.s3 }}>
        <AttachButton />
        <PillInput value={text} onChange={setText} />
        <SendButton ready={text.trim() !== ''} />
      </div>
    </div>
  )
}
