import { useHealth, type HostHealth } from '@automatos/theme-sdk'
import type { MascotName } from '@automatos/mascot/types'

import { Panel } from '../components/panel'
import { useHudLook } from '../lib/looks/use-hud-look'
import { AUTO_DOCK_SIZE, HudAuto } from '../mascot/hud-auto'
import styles from './auto-dock.module.css'

/**
 * Auto's dock at the foot of the rail, while the look's auto knob is on: a bracketed panel with Auto in it,
 * his state the backend's. Ready (idle) while it answers, loading while the host asks, asleep while it is
 * down. The chat's voice core (its own page) shows him working; the dock shows him on every other page.
 */

export const DOCK_TITLE = 'Auto'

/** What Auto shows for the backend's connection. */
export function dockState(connection: HostHealth['connection']): MascotName {
  if (connection === 'down') return 'sleeping'
  return connection === 'checking' ? 'loading' : 'idle'
}

export function AutoDock() {
  const { auto } = useHudLook()
  const { connection } = useHealth()
  if (auto === 'off') return null
  return (
    <Panel title={DOCK_TITLE} className={styles.dock}>
      <div className={styles.stage}>
        <HudAuto state={dockState(connection)} size={AUTO_DOCK_SIZE} />
      </div>
    </Panel>
  )
}
