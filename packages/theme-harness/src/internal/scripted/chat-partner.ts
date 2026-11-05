/**
 * SDK 1.5.0: who answers a theme's chat, and Plan, as core's frontend/lib/theme-sdk/internal/chat-partner.ts has them
 * (at 5e357cd7ffa5dc89725349784445fee5de985265). The agent is the conversation's own choice, Auto (null) as its screen
 * mounts. `chooseAgent(id)` picks one of the roster's agents, the roster the page areas answer (a test's
 * host.setPageQuery('useAgents'), read as the host reads its own cache, never kept as a theme's ask): false, and
 * nothing changes, for a session agent (`configuration.runtime` 'cli', components/chatbot/agent-selector.tsx
 * isSessionAgent), for an id the roster lacks and while the roster loads; a TypeError for anything but a positive whole
 * number or null. Plan is the host's own switch (core's Mission store `isPlanMode`, the one Studio's Plan button and a
 * `/chat?mode=plan` link set), shared by every chat on the page: a test sets it with setChatPlanMode and reads it with
 * chatPlanMode, and `setPlanMode(on)` sets it, a TypeError for anything but true or false. The turn sends both with the
 * next message (chat-turn.ts), as core's controller does.
 */
import type { HostChatController, RosterAgent } from '@automatos/theme-sdk'
import { useCallback, useMemo, useState } from 'react'
import { cell, refuse } from '../cell.ts'
import { useHostRead } from '../page-views.ts'

/** Who answers the conversation, and Plan. */
export type ChatPartner = Pick<HostChatController, 'agentId' | 'chooseAgent' | 'planMode' | 'setPlanMode'>

/** chat-partner.ts:34-35, in the SDK's words. */
const NOT_AN_AGENT_ID = 'chooseAgent takes an agent id from useAgents (a whole number), or null for Auto.'
const NOT_ON_OR_OFF = 'setPlanMode takes true or false.'
/** agent-selector.tsx:47: a session agent's runtime. */
const SESSION_RUNTIME = 'cli'

const planSwitch = cell(false)

/** Plan on or off from now on, for every chat on the page. */
export function setChatPlanMode(on: boolean): void {
  planSwitch.set(on)
}

/** Plan right now. */
export function chatPlanMode(): boolean {
  return planSwitch.get()
}

/** Plan off, as a test starts. */
export function resetChatPartner(): void {
  planSwitch.set(false)
}

function isAgentId(id: unknown): id is number {
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0
}

/** The conversation's agent (Auto to start) and the host's Plan switch, for one chat controller. */
export function useChatPartner(): ChatPartner {
  const [agentId, setAgentId] = useState<number | null>(null)
  const roster = useHostRead<readonly RosterAgent[]>('useAgents')
  const planMode = planSwitch.use()
  const chooseAgent = useCallback(
    (id: number | null): boolean => {
      if (id === null) {
        setAgentId(null)
        return true
      }
      if (!isAgentId(id)) return refuse(NOT_AN_AGENT_ID)
      const agent = roster?.find((each) => each.id === id)
      if (agent === undefined || agent.configuration?.runtime === SESSION_RUNTIME) return false
      setAgentId(id)
      return true
    },
    [roster],
  )
  const setPlanMode = useCallback((on: boolean): void => {
    if (typeof on !== 'boolean') refuse(NOT_ON_OR_OFF)
    setChatPlanMode(on)
  }, [])
  return useMemo(() => ({ agentId, chooseAgent, planMode, setPlanMode }), [agentId, chooseAgent, planMode, setPlanMode])
}
