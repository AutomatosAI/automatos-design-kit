import { memo } from 'react'
import type { MascotName } from '@automatos/mascot/types'

import { SPRITE_TICKS, useTicks } from '../motion/clock'
import { useMotion } from '../motion/use-motion'
import { AGENT_ART, AGENT_LOOKS, AGENT_SIZE, ICON_ART, ICON_SIZE, type ItemKind } from './agents-icons'
import { AUTO_SIZE } from './auto-sprite'
import type { Run } from './grid'
import { spriteState } from './states'
import styles from './art.module.css'

/**
 * Arcade's pixel art on screen: inline SVG, one rect per run of same-coloured pixels, each rect carrying its colour
 * key (data-k), which the stylesheet fills from the look's variables, so a palette change recolours every picture at
 * once. Sizes come from the stylesheet too (data-size), whole multiples of the art's pixels at the look's pixel
 * scale. A picture with a label is an image with that name; one without is decoration a screen reader skips.
 */

export type ArtSize = 'mark' | 'small' | 'large' | 'portrait' | 'still' | 'phone' | 'agent' | 'agent-small' | 'icon' | 'icon-small'

/** Which art the colour keys belong to: Auto's sprite, a party robot, an item icon or the map. */
export type ArtSet = 'auto' | 'agent' | 'icon' | 'map'

interface PixelArtProps {
  readonly art: ArtSet
  readonly runs: readonly Run<string>[]
  readonly size: number
  readonly view: ArtSize
  readonly label?: string
  /** A party robot's colour (1 to 4). */
  readonly agent?: number
}

export const PixelArt = memo(function PixelArt({ art, runs, size, view, label, agent }: PixelArtProps) {
  const name = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const }
  return (
    <svg
      className={styles.art}
      viewBox={`0 0 ${size} ${size}`}
      data-art={art}
      data-size={view}
      data-agent={agent}
      focusable="false"
      {...name}
    >
      {runs.map((run) => (
        <rect key={`${run.y}-${run.x}`} x={run.x} y={run.y} width={run.width} height={1} data-k={run.key} />
      ))}
    </svg>
  )
})

export interface AutoSpriteProps {
  readonly state: MascotName
  readonly view: ArtSize
  /** Auto's name and state for a screen reader; leave it out where the words around him say it. */
  readonly label?: string
  /** Hold the first frame whatever the motion setting (the gallery's stills, the frame's mark). */
  readonly still?: boolean
}

/** Auto in a state: its loop stepping on the clock while motion is on, its first frame otherwise. */
export function AutoSprite({ state, view, label, still = false }: AutoSpriteProps) {
  const { moving } = useMotion()
  const running = moving && !still
  const step = useTicks(SPRITE_TICKS, running)
  const { frames } = spriteState(state)
  const frame = running ? frames[step % frames.length] : frames[0]
  return (
    <span className={styles.sprite} data-state={state} data-size={view}>
      <PixelArt art="auto" runs={frame} size={AUTO_SIZE} view={view} label={label} />
    </span>
  )
}

/** A party member's robot: its look by its place in the roster. */
export function AgentAvatar({ index, view = 'agent', label }: { readonly index: number; readonly view?: ArtSize; readonly label?: string }) {
  const look = index % AGENT_LOOKS
  return <PixelArt art="agent" runs={AGENT_ART[look]} size={AGENT_SIZE} view={view} label={label} agent={look + 1} />
}

export function ItemIcon({ kind, view = 'icon' }: { readonly kind: ItemKind; readonly view?: ArtSize }) {
  return <PixelArt art="icon" runs={ICON_ART[kind]} size={ICON_SIZE} view={view} />
}
