import { useId } from 'react'
import type { MascotName } from '@automatos/mascot/types'

import { useMotion } from '../motion/use-motion'
import { AUTO_BOX, autoParts, EYE_PARTS, type Paint, type Part, type Stop } from './auto-geometry'
import { shapePath } from './auto-path'
import { kebab } from '../looks/names'
import styles from './art.module.css'

/**
 * Candy's Auto, drawn as SVG from his geometry (auto-geometry.ts): every shape a path, every paint a gradient in the
 * drawing's own units, every colour one of the look's --candy-auto-* properties. While the person lets things move
 * he floats 4 px over 3 s and blinks every few seconds, both CSS loops on one clock that the look's Motion knob
 * (--candy-play) and the Pause control stop; under reduced motion, paused, or before the saved choice is known he is
 * still. A live Auto has one name ("Auto, thinking"); a decorative one is hidden from the accessibility tree.
 */

export interface AutoProps {
  readonly state: MascotName
  /** Width and height in px. */
  readonly size: number
  /** What a screen reader hears; null for a decorative Auto. */
  readonly label?: string | null
  /** Never moves, whatever the motion setting (the style sheet's stills). */
  readonly still?: boolean
  readonly className?: string
}

const VIEW_BOX = `${AUTO_BOX.x} ${AUTO_BOX.y} ${AUTO_BOX.size} ${AUTO_BOX.size}`

const colourOf = (stop: Pick<Stop, 'colour'>): string => `var(--candy-auto-${kebab(stop.colour)})`

function StopsOf({ stops }: { readonly stops: readonly Stop[] }) {
  return (
    <>
      {stops.map((stop, index) => (
        <stop key={index} offset={stop.at} style={{ stopColor: colourOf(stop), stopOpacity: stop.alpha }} />
      ))}
    </>
  )
}

function Gradient({ id, paint }: { readonly id: string; readonly paint: Paint }) {
  if (paint.kind === 'linear') {
    const { x1, y1, x2, y2 } = paint
    return (
      <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
        <StopsOf stops={paint.stops} />
      </linearGradient>
    )
  }
  if (paint.kind === 'radial') {
    return (
      <radialGradient id={id} gradientUnits="userSpaceOnUse" cx={paint.cx} cy={paint.cy} r={paint.r}>
        <StopsOf stops={paint.stops} />
      </radialGradient>
    )
  }
  return null
}

function fillOf(paint: Paint, id: string): { fill: string; fillOpacity?: number } {
  return paint.kind === 'solid' ? { fill: colourOf(paint), fillOpacity: paint.alpha } : { fill: `url(#${id})` }
}

function PartDefs({ part, uid }: { readonly part: Part; readonly uid: string }) {
  return (
    <>
      {part.paints.map((paint, index) => (
        <Gradient key={index} id={`${uid}-${part.name}-${index}`} paint={paint} />
      ))}
      {part.glow && (
        <filter id={`${uid}-${part.name}-glow`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation={part.glow.blur / 2} />
        </filter>
      )}
    </>
  )
}

function PartShape({ part, uid }: { readonly part: Part; readonly uid: string }) {
  const d = shapePath(part.shape)
  const fillRule = part.shape.kind === 'arch' ? 'evenodd' : undefined
  return (
    <g data-part={part.name} className={EYE_PARTS.has(part.name) ? styles.eye : undefined}>
      {part.glow && (
        <path d={d} fillRule={fillRule} filter={`url(#${uid}-${part.name}-glow)`} style={{ fill: colourOf(part.glow), fillOpacity: part.glow.alpha }} />
      )}
      {part.paints.map((paint, index) => (
        <path key={index} d={d} fillRule={fillRule} style={fillOf(paint, `${uid}-${part.name}-${index}`)} />
      ))}
    </g>
  )
}

export function Auto({ state, size, label = null, still = false, className }: AutoProps) {
  const uid = useId().replace(/:/g, '')
  const { moving } = useMotion()
  const parts = autoParts(state)
  const named = label !== null
  return (
    <svg
      className={[styles.auto, className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox={VIEW_BOX}
      data-state={state}
      data-moving={moving && !still ? 'true' : undefined}
      role={named ? 'img' : undefined}
      aria-label={named ? label : undefined}
      aria-hidden={named ? undefined : true}
      focusable="false"
    >
      <defs>
        {parts.map((part) => (
          <PartDefs key={part.name} part={part} uid={uid} />
        ))}
      </defs>
      <g className={styles.float}>
        {parts.map((part) => (
          <PartShape key={part.name} part={part} uid={uid} />
        ))}
      </g>
    </svg>
  )
}
