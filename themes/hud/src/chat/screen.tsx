import type { ReactNode, RefObject } from 'react'
import { FirstRunNudge } from '@automatos/theme-sdk'

import { NewChatButton } from '../components/new-chat'
import { THEME_HEADING } from '../theme'
import type { ScreenLayout } from './layout'
import { AgentsPanel } from './panels/agents-panel'
import { DeliverablesPanel } from './panels/deliverables-panel'
import { MissionPanel } from './panels/mission-panel'
import { MissionsPanel } from './panels/missions-panel'
import { NeedsYouPanel } from './panels/needs-you-panel'
import { NextUpPanel } from './panels/next-up-panel'
import { SystemsPanel } from './panels/systems-panel'
import { TodayPanel } from './panels/today-panel'
import styles from './screen.module.css'

/**
 * The core screen's layout ("Automatos Command HUD.dc.html"): the conversation's column in the middle (its title,
 * the core, the transcript, the voice deck and the message box) between the side panels. Three columns put AGENTS and MISSION on
 * the left and DELIVERABLES on the right, as the design does, with TODAY, NEEDS YOU and NEXT UP over it in the places
 * of the design's SPEND, LATENCY and THIS MACHINE, which the SDK gives a theme no source for (the design's own rule
 * is to hide a panel without one); two put them all in one column on the right; one is the design's phone, the
 * conversation alone. HUD 1.2.0 (PRD-268): MISSIONS (the Missions, each where it stands) under MISSION, and SYSTEMS
 * (what Auto depends on) at the foot of the right column. While the day's brief shows, BRIEFING takes the panels
 * column TODAY is in, in three columns and in two, and the transcript's slot in one; it folds back into TODAY and
 * NEEDS YOU (briefing/). In one column a card waiting for you keeps the transcript in its slot, so BRIEFING never
 * hides an approval. The title is the screen's h1, which the host focuses when the page opens, with New chat beside
 * it. The host's first-run nudge (the local edition's, until a key exists or it is dismissed) sits under the title
 * row: its pill floats from a zero-height anchor over the top of the core, never over the title, New chat or the
 * message box.
 */

export interface ChatScreenProps {
  /** The screen's element, which the layout measures (layout.ts useScreenLayout). */
  readonly screenRef: RefObject<HTMLDivElement | null>
  readonly layout: ScreenLayout
  /** The conversation's title. */
  readonly title: string
  /** The voice core. */
  readonly core: ReactNode
  /** Under the transcript: the host's banners, the voice deck and the message box. */
  readonly footer?: ReactNode
  /** The transcript. */
  readonly children?: ReactNode
  /** The Mission this conversation plans, which MISSION shows first; null or absent for none. */
  readonly missionId?: string | null
  /** BRIEFING while the day's brief shows; null or absent for none. */
  readonly briefing?: ReactNode
  /** A card in the conversation waits for you: in one column the transcript keeps its slot. */
  readonly keepTranscript?: boolean
}

function LeftPanels({ missionId }: { readonly missionId: string | null }) {
  return (
    <div className={styles.side}>
      <AgentsPanel />
      <MissionPanel missionId={missionId} />
      <MissionsPanel />
    </div>
  )
}

function WorkPanels({ all, missionId }: { readonly all: boolean; readonly missionId: string | null }) {
  return (
    <>
      {all && <AgentsPanel />}
      {all && <MissionPanel missionId={missionId} />}
      {all && <MissionsPanel />}
      <TodayPanel />
      <NeedsYouPanel />
      <NextUpPanel />
      <DeliverablesPanel />
      <SystemsPanel />
    </>
  )
}

interface RightPanelsProps {
  readonly all: boolean
  readonly missionId: string | null
  readonly briefing: ReactNode
}

/** The panels column TODAY is in: BRIEFING while the brief shows, the panels otherwise. */
function RightPanels({ all, missionId, briefing }: RightPanelsProps) {
  return <div className={styles.side}>{briefing ?? <WorkPanels all={all} missionId={missionId} />}</div>
}

/** BRIEFING stands in the transcript's slot: at one column, while it shows, unless a card waiting keeps the transcript. */
export function briefingInSlot(columns: ScreenLayout['columns'], briefing: boolean, keepTranscript: boolean): boolean {
  return columns === 'one' && briefing && !keepTranscript
}

export function ChatScreen(props: ChatScreenProps) {
  const { screenRef, layout, title, core, footer, children, missionId = null, briefing = null, keepTranscript = false } = props
  const { columns } = layout
  const inSlot = briefingInSlot(columns, briefing !== null, keepTranscript)
  return (
    <div ref={screenRef} className={styles.screen} data-columns={columns}>
      {columns === 'three' && <LeftPanels missionId={missionId} />}
      <div className={styles.centre}>
        <div className={styles.titleRow}>
          <h1 className={styles.title} tabIndex={-1} {...THEME_HEADING}>
            {title}
          </h1>
          <NewChatButton />
        </div>
        <FirstRunNudge />
        {core}
        {inSlot ? <div className={styles.briefingSlot}>{briefing}</div> : children}
        {footer !== undefined && <div className={styles.footer}>{footer}</div>}
      </div>
      {columns !== 'one' && <RightPanels all={columns === 'two'} missionId={missionId} briefing={briefing} />}
    </div>
  )
}
