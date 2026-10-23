/**
 * PRD-261 B-02b: the fake of SDK area `pages/agents`. It mirrors core's frontend/lib/theme-sdk/pages/agents.ts
 * (at 101a0bf33f64fb4f89af81b4293415be60b661ac): two reads in the page areas' frozen view
 * (src/internal/page-views.ts), answering what a test set with host.setPageQuery('useAgents' | 'useAgentStats').
 */
import type { AgentStatistics, RosterAgent } from '@automatos/theme-sdk'
import { usePageQuery } from '../internal/page-views.ts'

type Sdk = typeof import('@automatos/theme-sdk')

const NO_ARGS: readonly unknown[] = Object.freeze([])

/** agents.ts:75: the workspace's roster. */
export const useAgents = (() => usePageQuery<readonly RosterAgent[]>('useAgents', NO_ARGS)) satisfies Sdk['useAgents']

/** agents.ts:80: the workspace's agent counts. */
export const useAgentStats = (() => usePageQuery<AgentStatistics>('useAgentStats', NO_ARGS)) satisfies Sdk['useAgentStats']
