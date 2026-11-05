import type { ReactNode } from 'react'
import { type HostChatController, HostLink } from '@automatos/theme-sdk'

import { CODE, MISSION, type ModeLink, MODES_LABEL, PLAN_LABEL, PLAN_TITLE } from './modes'
import styles from './modes.module.css'

/**
 * HUD 1.4.0: the row under the message box. First the agent the box talks to (agent-picker.tsx); then the modes, CODE,
 * PLAN and MISSION, drawn as HUD's chips: mono capitals in a square outline. CODE and MISSION are links to the host's
 * page for each (modes.ts); PLAN is a toggle (aria-pressed) on the host's own Plan switch, the chat controller's
 * planMode and setPlanMode (SDK 1.5.0), lit in the accent while on. Tab reaches each after Send. On the desktop the row
 * sits between the box and its keys; on the phone it sits in the dock under the control row, whether TYPE has the box
 * open or not, at the 44 px tap size.
 */

/** The host's Plan switch, as the chat controller hands it out. */
export type PlanSwitch = Pick<HostChatController, 'planMode' | 'setPlanMode'>

export interface ModeRowProps {
  readonly plan: PlanSwitch
  /** The agent picker, first in the row. */
  readonly agent?: ReactNode
  /** The phone's dock: 44 px targets, the row centred. */
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
