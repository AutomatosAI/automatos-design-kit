import { type CSSProperties, memo } from 'react'
import type { Mission } from '@automatos/theme-sdk'

import { MAP_COLUMNS, MAP_RECTS, MAP_ROWS, type MapSpot, TILE } from '../art/world-map'
import { missionStatus, REGIONS } from './quests'
import art from '../art/art.module.css'
import styles from './quests.module.css'
import ui from '../ui/ui.module.css'

/**
 * The overworld map with the region names and a marker for each Mission. The map is drawn once (inline SVG whose
 * tiles take the palette's map colours) and is decoration; each marker is a button named by its Mission's goal and
 * state, pressed while its quest window is open.
 */

const Terrain = memo(function Terrain() {
  return (
    <svg className={`${art.art} ${styles.terrain}`} viewBox={`0 0 ${MAP_COLUMNS * TILE} ${MAP_ROWS * TILE}`} preserveAspectRatio="none" aria-hidden="true" focusable="false" data-art="map">
      {MAP_RECTS.map((rect, index) => (
        <rect key={index} x={rect.x} y={rect.y} width={rect.width} height={rect.height} data-k={rect.key} />
      ))}
    </svg>
  )
})

const percent = (value: number, of: number): string => `${((value + 0.5) / of) * 100}%`

export interface MapViewProps {
  readonly missions: readonly Mission[]
  readonly spots: ReadonlyMap<string, MapSpot>
  readonly selected: string | null
  readonly onSelect: (id: string) => void
}

export function MapView({ missions, spots, selected, onSelect }: MapViewProps) {
  return (
    <div className={styles.map}>
      <Terrain />
      {REGIONS.map(({ region, name, status }) => (
        <p key={region} className={styles.region} data-region={region}>
          <span className={ui.status} data-tone={status.tone}>
            <span aria-hidden="true">{status.glyph}</span> {status.word.toUpperCase()}
          </span>
          <span className={styles.regionName}>{name}</span>
        </p>
      ))}
      {missions.map((mission) => {
        const spot = spots.get(mission.id)
        if (!spot) return null
        const status = missionStatus(mission)
        return (
          <button
            key={mission.id}
            type="button"
            className={styles.marker}
            data-tone={status.tone}
            style={{ '--marker-x': percent(spot.tx, MAP_COLUMNS), '--marker-y': percent(spot.ty, MAP_ROWS) } as CSSProperties}
            aria-label={`${mission.goal}, ${status.word.toLowerCase()}`}
            aria-pressed={selected === mission.id}
            onClick={() => onSelect(mission.id)}
          >
            <span aria-hidden="true">{status.glyph}</span>
          </button>
        )
      })}
    </div>
  )
}
