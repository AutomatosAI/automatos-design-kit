/**
 * Where the skin designer's draft starts (src/phone/designer.ts): theme.json's own `mobile` block, when it has one (the
 * designer's starting point until a change); Studio's own colours; or one of the theme's looks turned into its tokens,
 * the look's colours in the scheme of its tone and Studio's in the other. A look that paints no ground or text is no
 * start, and a theme with no looks offers none.
 */
import type { HostLook } from '@automatos/theme-sdk'
import { useState, type CSSProperties } from 'react'

export const START_BLOCK = "Start from theme.json's block"
export const START_STUDIO = "Start from Studio's colours"
export const START_LOOK = 'Start from this look'
export const START_LOOK_LABEL = 'The look to start from'

const ROW_STYLE: CSSProperties = Object.freeze({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px' })

export interface StartRowProps {
  readonly hasBlock: boolean
  readonly looks: readonly HostLook[]
  /** The look the choice opens on: the member's look on the phone. */
  readonly look: string | null
  /** True when the look with this id paints a ground and text, so it can be a start. */
  readonly startsFrom: (look: string) => boolean
  readonly onBlock: () => void
  readonly onStudio: () => void
  readonly onLook: (look: string) => void
}

export function StartRow({ hasBlock, looks, look, startsFrom, onBlock, onStudio, onLook }: StartRowProps) {
  const opening = looks.find((preset) => preset.id === look)?.id ?? looks[0]?.id ?? ''
  const [chosen, setChosen] = useState(opening)
  return (
    <div role="group" aria-label="Start the draft" style={ROW_STYLE}>
      {hasBlock ? <button type="button" onClick={onBlock}>{START_BLOCK}</button> : null}
      <button type="button" onClick={onStudio}>{START_STUDIO}</button>
      {looks.length === 0 ? null : (
        <>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {START_LOOK_LABEL}
            <select value={chosen} onChange={(event) => setChosen(event.target.value)}>
              {looks.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
            </select>
          </label>
          <button type="button" disabled={!startsFrom(chosen)} onClick={() => onLook(chosen)}>{START_LOOK}</button>
        </>
      )}
    </div>
  )
}
