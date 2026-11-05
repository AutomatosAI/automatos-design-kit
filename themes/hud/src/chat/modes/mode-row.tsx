import type { ReactNode } from 'react'
import { HostLink } from '@automatos/theme-sdk'

import { CHAT_MODES, MODES_LABEL } from './modes'
import styles from './modes.module.css'

/**
 * HUD 1.4.0: the row under the message box. First the agent the box talks to (agent-picker.tsx), where the host's
 * chat can choose one; then the modes, CODE, PLAN and MISSION, each a link to the host's page for it (modes.ts), drawn
 * as HUD's chips: mono capitals in a square outline. They are links, so Tab reaches each after Send, and Enter
 * follows it. On the desktop the row sits between the box and its keys; on the phone it sits in the dock under the
 * control row, whether TYPE has the box open or not, at the 44 px tap size.
 */

export interface ModeRowProps {
  /** The agent picker, first in the row; null where the host's chat can choose no agent. */
  readonly agent?: ReactNode
  /** The phone's dock: 44 px targets, the row centred. */
  readonly phone?: boolean
}

export function ModeRow({ agent = null, phone = false }: ModeRowProps) {
  return (
    <div className={styles.row} data-layout={phone ? 'phone' : 'desktop'}>
      {agent}
      <div className={styles.modes} role="group" aria-label={MODES_LABEL}>
        {CHAT_MODES.map((mode) => (
          <HostLink key={mode.id} href={mode.href} className={styles.mode} title={mode.opens}>
            {mode.label}
          </HostLink>
        ))}
      </div>
    </div>
  )
}
