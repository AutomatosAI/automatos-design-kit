import type { CSSProperties } from 'react'

import type { MascotName } from '@automatos/mascot/types'

import { HudAuto, HudPauseControl } from '../mascot/hud-auto'
import { autoLabel } from './chip'
import type { CoreSize } from './layout'
import styles from './voice-core.module.css'

/**
 * The core ("Automatos Command HUD.dc.html"'s voice core): concentric rings in the look's accent, Auto on his ring
 * in the middle while the look's auto knob is on (HudAuto draws nothing while it is off), and the state chip under
 * him, which says in words what the rings and Auto show. Pause Auto stands beside the chip, in one row over the
 * ring's foot, not under Auto among the rings, both on the page's ground. The rings are the design's: a tick ring
 * turning in 60 s, an arc in 7 s, a segmented ring back in 16 s, a dashed ring in 30 s, an inner arc back in 5 s
 * and a pulse every 2.4 s, each marked data-hud-loop so the look's motion knob stops it, and the OS setting stops
 * them all. The rings are decoration (hidden from assistive technology); the chip is a polite live region, so each
 * change is heard. 420 px with Auto at 150 on a tall screen, the phone's 290 px with Auto at 104 otherwise.
 */

export const CORE_LABEL = "Auto's core"

/** Auto's stage height in px, by the core's size (the design's 150 on desktop, 104 on a phone). */
export const CORE_MASCOT_SIZE: Readonly<Record<CoreSize, number>> = { large: 150, small: 104 }

/** Each ring by its class: the loops carry data-hud-loop. */
const RINGS: readonly { readonly name: string; readonly loops: boolean }[] = [
  { name: 'outer', loops: false },
  { name: 'ticks', loops: true },
  { name: 'arc', loops: true },
  { name: 'segments', loops: true },
  { name: 'dashes', loops: true },
  { name: 'innerArc', loops: true },
  { name: 'pulse', loops: true },
  { name: 'crossX', loops: false },
  { name: 'crossY', loops: false },
]

type MascotSizeStyle = CSSProperties & { readonly '--hud-core-mascot': string }

function CoreRings() {
  return (
    <div className={styles.rings} aria-hidden="true">
      {RINGS.map((ring) => (
        <span key={ring.name} className={`${styles.ring} ${styles[ring.name]}`} data-hud-loop={ring.loops ? '' : undefined} />
      ))}
    </div>
  )
}

export interface VoiceCoreProps {
  /** What Auto shows (his reducer's state). */
  readonly state: MascotName
  /** The state in words (chip.ts). */
  readonly chip: string
  readonly size: CoreSize
  /** A one-shot's clip ended (his driver's onClipEnded). */
  readonly onClipEnded?: (state: MascotName) => void
}

export function VoiceCore({ state, chip, size, onClipEnded }: VoiceCoreProps) {
  const mascot = CORE_MASCOT_SIZE[size]
  const place: MascotSizeStyle = { '--hud-core-mascot': `${mascot}px` }
  return (
    <div className={styles.core} role="group" aria-label={CORE_LABEL} data-size={size} data-state={state}>
      <CoreRings />
      <div className={styles.auto} style={place}>
        <HudAuto
          state={state}
          onClipEnded={onClipEnded}
          size={mascot}
          caption={autoLabel(chip)}
          showCaption={false}
          pause={false}
        />
      </div>
      <div className={styles.chipRow}>
        <p className={styles.chip} aria-live="polite" aria-atomic="true">
          {chip}
        </p>
        <HudPauseControl />
      </div>
    </div>
  )
}
