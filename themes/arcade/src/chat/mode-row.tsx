import type { ReactNode } from 'react'
import { type HostChatController, HostLink } from '@automatos/theme-sdk'

import { CODE, MISSION, type ModeLink, MODES_LABEL, PLAN_LABEL, PLAN_TITLE } from './chat-modes'
import styles from './modes.module.css'

/**
 * Arcade 1.1.0: the row under the message box, on the host strip (after themes/hud/src/chat/modes/mode-row.tsx, HUD
 * 1.4.0). First the agent the box talks to (agent-picker.tsx); then Code, Plan and Mission in Studio's tokens, as the
 * strip is drawn. Code and Mission are links to the host's page for each (chat-modes.ts); Plan is a toggle
 * (aria-pressed) on the host's own Plan switch, the chat controller's planMode and setPlanMode (SDK 1.5.0), filled with
 * the primary colour while on. Tab reaches each after Send. On the handheld they are 44 px targets.
 */

/** The host's Plan switch, as the chat controller hands it out. */
export type PlanSwitch = Pick<HostChatController, 'planMode' | 'setPlanMode'>

export interface ModeRowProps {
  readonly plan: PlanSwitch
  /** The agent picker, first in the row. */
  readonly agent?: ReactNode
  /** The phone's layout: 44 px targets. */
  readonly phone?: boolean
}

function ModeChip({ mode }: { readonly mode: ModeLink }) {
  return (
    <HostLink href={mode.href} className={styles.mode} title={mode.opens}>
      {mode.label}
    </HostLink>
  )
}

export function ModeRow({ plan, agent = null, phone = false }: ModeRowProps) {
  const { planMode, setPlanMode } = plan
  return (
    <div className={styles.row} data-layout={phone ? 'phone' : 'desktop'}>
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
