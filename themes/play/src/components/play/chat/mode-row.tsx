'use client'

import type { ReactNode } from 'react'
import { HostLink } from '@automatos/theme-sdk'

import { CHAT_MODES, MODES_LABEL } from './chat-modes'
import styles from './composer.module.css'

/**
 * Play 1.5.0: the row under the message box, in the box's width (after themes/hud/src/chat/modes/mode-row.tsx, HUD
 * 1.4.0). First the agent the box talks to (agent-picker.tsx), where the host's chat can choose one; then Code, Plan
 * and Mission, each a link to the host's page for it (chat-modes.ts), drawn as Play's outlined pills. They are links,
 * so Tab reaches each after Send, and Enter follows it. On a phone they are 44 px targets (composer.module.css).
 */

export interface ModeRowProps {
  /** The agent picker, first in the row; null where the host's chat can choose no agent. */
  readonly agent?: ReactNode
}

export function ModeRow({ agent = null }: ModeRowProps) {
  return (
    <div className={styles.tools}>
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
