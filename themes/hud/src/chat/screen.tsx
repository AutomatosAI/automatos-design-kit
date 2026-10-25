import type { ReactNode, RefObject } from 'react'
import { FirstRunNudge } from '@automatos/theme-sdk'

import { THEME_HEADING } from '../theme'
import type { ScreenLayout } from './layout'
import { AgentsPanel } from './panels/agents-panel'
import { DeliverablesPanel } from './panels/deliverables-panel'
import { MissionPanel } from './panels/mission-panel'
import styles from './screen.module.css'

/**
 * The core screen's layout ("Automatos Command HUD.dc.html"): the conversation's column in the middle (its title,
 * the core, the transcript and the message box) between the side panels. Three columns put AGENTS and MISSION on
 * the left and DELIVERABLES on the right, as the design does; two put all three in one column on the right; one is
 * the design's phone, the conversation alone. The design's other panels (spend, latency, this machine) are not
 * drawn: the SDK gives a theme no source for them, and the design's own rule is to hide a panel without one. The
 * title is the screen's h1, which the host focuses when the page opens. The host's first-run nudge (the local
 * edition's, until a key exists or it is dismissed) heads the conversation's column: its pill floats over the top of
 * the column from a zero-height anchor, never over the message box.
 */

export interface ChatScreenProps {
  /** The screen's element, which the layout measures (layout.ts useScreenLayout). */
  readonly screenRef: RefObject<HTMLDivElement | null>
  readonly layout: ScreenLayout
  /** The conversation's title. */
  readonly title: string
  /** The voice core. */
  readonly core: ReactNode
  /** Under the transcript: the host's banners and the message box. */
  readonly footer?: ReactNode
  /** The transcript. */
  readonly children?: ReactNode
}

function LeftPanels() {
  return (
    <div className={styles.side}>
      <AgentsPanel />
      <MissionPanel />
    </div>
  )
}

function RightPanels({ all }: { readonly all: boolean }) {
  return (
    <div className={styles.side}>
      {all && <AgentsPanel />}
      {all && <MissionPanel />}
      <DeliverablesPanel />
    </div>
  )
}

export function ChatScreen({ screenRef, layout, title, core, footer, children }: ChatScreenProps) {
  const { columns } = layout
  return (
    <div ref={screenRef} className={styles.screen} data-columns={columns}>
      {columns === 'three' && <LeftPanels />}
      <div className={styles.centre}>
        <FirstRunNudge />
        <h1 className={styles.title} tabIndex={-1} {...THEME_HEADING}>
          {title}
        </h1>
        {core}
        {children}
        {footer !== undefined && <div className={styles.footer}>{footer}</div>}
      </div>
      {columns !== 'one' && <RightPanels all={columns === 'two'} />}
    </div>
  )
}
