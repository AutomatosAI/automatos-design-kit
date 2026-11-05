import { CHAT_HREF } from '@automatos/theme-sdk'

/**
 * Play 1.5.0, after themes/hud/src/chat/modes/modes.ts (HUD 1.4.0): the chat's modes, the three that Studio's chat
 * offers under its message box, each a link to the host's own page for it. Code opens the host's chat with the code
 * canvas (`/chat?repo=.`), Plan opens it with plan mode on (`/chat?mode=plan`), and Mission opens Missions
 * (`/assignments?tab=missions`). `repo` and `mode` are on theme.json's keepCorePage list, so for the first two the
 * host draws its own chat page, never Play's. Pure.
 */

export type ChatModeId = 'code' | 'plan' | 'mission'

export interface ChatMode {
  readonly id: ChatModeId
  /** The word the link shows, which is its accessible name. */
  readonly label: string
  /** What the link opens, in a few words: its title. */
  readonly opens: string
  readonly href: string
}

/** The modes' group, as a screen reader names it. */
export const MODES_LABEL = 'Modes'
export const CODE_HREF = `${CHAT_HREF}?repo=.`
export const PLAN_HREF = `${CHAT_HREF}?mode=plan`
export const MISSIONS_HREF = '/assignments?tab=missions'

export const CHAT_MODES: readonly ChatMode[] = Object.freeze([
  { id: 'code', label: 'Code', opens: 'Open the chat with the code canvas', href: CODE_HREF },
  { id: 'plan', label: 'Plan', opens: 'Open the chat in plan mode', href: PLAN_HREF },
  { id: 'mission', label: 'Mission', opens: 'Open Missions', href: MISSIONS_HREF },
])
