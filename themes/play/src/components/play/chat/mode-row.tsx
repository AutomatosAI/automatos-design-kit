'use client'

import type { ReactNode } from 'react'
import { type HostChatController, HostLink } from '@automatos/theme-sdk'

import { CODE, MISSION, type ModeLink, MODES_LABEL, PLAN_LABEL, PLAN_TITLE } from './chat-modes'
import styles from './composer.module.css'

/**
 * Play 1.5.0: the row under the message box, in the box's width (after themes/hud/src/chat/modes/mode-row.tsx, HUD
 * 1.4.0). First the agent the box talks to (agent-picker.tsx); then Code, Plan and Mission as Play's outlined pills.
 * Code and Mission are links to the host's page for each (chat-modes.ts); Plan is a toggle (aria-pressed) on the host's
 * own Plan switch, the chat controller's planMode and setPlanMode (SDK 1.5.0), edged in the accent as text while on.
 * Tab reaches each after Send. On a phone they are 44 px targets (composer.module.css).
 */

/** The host's Plan switch, as the chat controller hands it out. */
export type PlanSwitch = Pick<HostChatController, 'planMode' | 'setPlanMode'>

export interface ModeRowProps {
  readonly plan: PlanSwitch
  /** The agent picker, first in the row. */
  readonly agent?: ReactNode
}

function ModeChip({ mode }: { readonly mode: ModeLink }) {
  return (
    <HostLink href={mode.href} className={styles.mode} title={mode.opens}>
      {mode.label}
    </HostLink>
  )
}

export function ModeRow({ plan, agent = null }: ModeRowProps) {
  const { planMode, setPlanMode } = plan
  return (
    <div className={styles.tools}>
      {agent}
      <div className={styles.modes} role="group" aria-label={MODES_LABEL}>
        <ModeChip mode={CODE} />
        <button type="button" className={styles.mode} aria-pressed={planMode} title={PLAN_TITLE} onClick={() => setPlanMode(!planMode)}>
          {PLAN_LABEL}
        </button>
        <ModeChip mode={MISSION} />
      </div>
    </div>
  )
}
