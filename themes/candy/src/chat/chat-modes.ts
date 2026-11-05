import { CHAT_HREF } from '@automatos/theme-sdk'

/**
 * Candy 1.1.0, after themes/hud/src/chat/modes/modes.ts (HUD 1.4.0): the chat's modes, the three that Studio's chat
 * offers under its message box. Code and Mission are links to the host's own page for each: the host's chat with the
 * code canvas (`/chat?repo=.`; `repo` is on theme.json's keepCorePage list, so the host draws its own chat page there)
 * and Missions (`/assignments?tab=missions`). Plan is the host's own switch, a toggle on the chat controller (SDK
 * 1.5.0's `planMode` and `setPlanMode`, the one Studio's Plan button and a `/chat?mode=plan` link set). A session agent
 * opens with a link to `/chat?agent=<id>`, the host's chat with that agent's session. Pure.
 */

export interface ModeLink {
  readonly id: 'code' | 'mission'
  /** The word the link shows, which is its accessible name. */
  readonly label: string
  /** What the link opens, in a few words: its title. */
  readonly opens: string
  readonly href: string
}

/** The modes' group, as a screen reader names it. */
export const MODES_LABEL = 'Modes'
export const CODE_HREF = `${CHAT_HREF}?repo=.`
export const MISSIONS_HREF = '/assignments?tab=missions'
/** The link parameter that opens one agent on the host's chat (SDK 1.5.0). */
export const AGENT_PARAM = 'agent'

export const CODE: ModeLink = Object.freeze({ id: 'code', label: 'Code', opens: 'Open the chat with the code canvas', href: CODE_HREF })
export const MISSION: ModeLink = Object.freeze({ id: 'mission', label: 'Mission', opens: 'Open Missions', href: MISSIONS_HREF })
export const PLAN_LABEL = 'Plan'
export const PLAN_TITLE = 'Plan first: Auto researches and plans, and runs nothing'

/** The host's chat with one agent: a session agent's session (`/chat?agent=<id>`). */
export function agentHref(id: number): string {
  return `${CHAT_HREF}?${AGENT_PARAM}=${encodeURIComponent(String(id))}`
}
