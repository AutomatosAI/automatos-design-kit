import type { HostChatController, RosterAgent } from '@automatos/theme-sdk'

import { CODE_HREF } from './chat-modes'

/**
 * Play 1.5.0, after themes/hud/src/chat/modes/agent-choice.ts (HUD 1.4.0): the one place Play reads which agent the
 * message box talks to. SDK 1.5.0's chat controller says it (`agentId`, null for Auto) and chooses one (`chooseAgent`,
 * false for an agent it refuses), and its roster says an agent's runtime (`configuration.runtime`); SDK 1.4.0, the one
 * the kit vendors, has none of them. So they are read here only when the host's controller has them: on a 1.4.0 host
 * there is no choice, no picker, and the box talks to Auto. A session agent (its runtime the CLI) runs in a session of
 * its own: its link opens it, and the box never talks to it. Pure.
 */

export const AUTO_NAME = 'Auto'
/** A session agent's runtime. */
export const SESSION_RUNTIME = 'cli'
/** The name for a chosen agent the roster doesn't list (yet, or any more). */
export const UNLISTED_AGENT = 'Agent'
const ACTIVE = 'active'

export interface AgentChoice {
  /** The agent the box talks to; null for Auto. */
  readonly agentId: number | null
  /** Talk to this agent (null for Auto); false, and nothing changes, when the host refuses it. */
  readonly chooseAgent: (id: number | null) => boolean
}

/** SDK 1.5.0's roster field, absent from a 1.4.0 roster. */
type Configured = RosterAgent & { readonly configuration?: { readonly runtime?: string | null } | null }

/** The chat's agent choice, or null where the host's controller has none (SDK 1.4.0). */
export function agentChoiceOf(chat: HostChatController): AgentChoice | null {
  const { agentId, chooseAgent } = chat as HostChatController & Partial<AgentChoice>
  if (typeof chooseAgent !== 'function') return null
  return { agentId: typeof agentId === 'number' ? agentId : null, chooseAgent }
}

/** An agent's runtime as the roster says it; null where it says none. */
export function runtimeOf(agent: RosterAgent): string | null {
  return (agent as Configured).configuration?.runtime ?? null
}

export function isSessionAgent(agent: RosterAgent): boolean {
  return runtimeOf(agent) === SESSION_RUNTIME
}

/** The agents the picker lists: the active ones that can run now, in the roster's order. */
export function pickableAgents(agents: readonly RosterAgent[] | null): readonly RosterAgent[] {
  return (agents ?? []).filter((agent) => agent.status === ACTIVE && !agent.unavailable)
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

/**
 * Where a session agent's link goes: the host's chat with the code canvas, until core confirms the link that opens
 * the agent's own session (then the agent's id goes into it).
 */
export function sessionHref(_agent: Pick<RosterAgent, 'id'>): string {
  return CODE_HREF
}
