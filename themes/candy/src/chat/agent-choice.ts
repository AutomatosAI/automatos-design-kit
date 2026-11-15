import type { HostChatController, RosterAgent } from '@automatos/theme-sdk'

import { agentHref } from './chat-modes'

/**
 * Candy 1.1.0, after themes/hud/src/chat/modes/agent-choice.ts (HUD 1.4.0): who the message box talks to, on SDK
 * 1.5.0's chat controller (`agentId`, null for Auto, and `chooseAgent`, false for an agent the host refuses) and its
 * roster (`configuration.runtime`). A session agent (its runtime the CLI) runs in a session of its own: its link opens
 * it (`/chat?agent=<id>`), and the box never talks to it. Pure.
 */

export const AUTO_NAME = 'Auto'
/** A session agent's runtime. */
export const SESSION_RUNTIME = 'cli'
/** The name for a chosen agent the roster doesn't list (yet, or any more). */
export const UNLISTED_AGENT = 'Agent'
const ACTIVE = 'active'

/** The chat controller's agent and its choice. */
export type AgentChoice = Pick<HostChatController, 'agentId' | 'chooseAgent'>

export function isSessionAgent(agent: RosterAgent): boolean {
  return agent.configuration?.runtime === SESSION_RUNTIME
}

/** An agent the box can talk to, or whose session can open: active, and able to run now. */
export function isPickable(agent: RosterAgent): boolean {
  return agent.status === ACTIVE && !agent.unavailable
}

/** The agents the picker lists, in the roster's order. */
export function pickableAgents(agents: readonly RosterAgent[] | null): readonly RosterAgent[] {
  return (agents ?? []).filter(isPickable)
}

/** The name of the agent the box talks to: Auto for none, the roster's name for one, else UNLISTED_AGENT. */
export function chosenName(roster: readonly RosterAgent[], agentId: number | null): string {
  if (agentId === null) return AUTO_NAME
  return roster.find((agent) => agent.id === agentId)?.name ?? UNLISTED_AGENT
}

/** The message box's placeholder and name: "Message Auto", or "Message <the agent it talks to>". */
export function messagePlaceholder(name: string): string {
  return `Message ${name}`
}

/** Where a session agent's link goes: the host's chat with that agent's session. */
export function sessionHref(agent: Pick<RosterAgent, 'id'>): string {
  return agentHref(agent.id)
}
