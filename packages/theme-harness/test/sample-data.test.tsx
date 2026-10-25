// The made-up answers the harness page gives the page areas' reads (src/host/sample-data.ts), so HUD's AGENTS and
// MISSION panels show rows in the shots, not their loading line: until they are given every read is loading, as in a
// theme's tests; once given, the roster, its counts and one running Mission answer; and the harness page gives them
// before it draws the mock host (app/main.tsx).
import { useActivityFeed, useAgents, useAgentStats } from '@automatos/theme-sdk'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '../src/host.ts'
import { giveSampleData } from '../src/host/sample-data.ts'

const LOADING = 'loading'
/** HUD's MISSION panel's read (themes/hud/src/chat/panels/mission-panel.tsx RUNNING_MISSION). */
const RUNNING_MISSION = Object.freeze({ types: ['mission'] as const, status: 'working' as const, limit: 1 })
// From the string import.meta.url: under jsdom, `new URL()` is jsdom's class, which fileURLToPath refuses.
const MAIN = resolve(dirname(fileURLToPath(import.meta.url)), '../app/main.tsx')

/** The three reads as a theme's panels make them, each as a line. */
function Panels() {
  const agents = useAgents().data
  const stats = useAgentStats().data
  const mission = useActivityFeed(RUNNING_MISSION).data?.items[0]
  const progress = mission?.step_progress
  return (
    <ul>
      <li data-testid="agents">{agents === null ? LOADING : agents.map((agent) => agent.name).join(', ')}</li>
      <li data-testid="stats">{stats === null ? LOADING : `${stats.active_agents} of ${stats.total_agents} active`}</li>
      <li data-testid="mission">
        {mission === undefined ? LOADING : `${mission.type} ${mission.status}: ${mission.name}, step ${progress?.current} of ${progress?.total}`}
      </li>
    </ul>
  )
}

const line = (id: string): string => screen.getByTestId(id).textContent ?? ''

beforeEach(() => {
  host.reset()
})

describe("the harness page's sample data", () => {
  it('is not there in a test until it is given: every read is loading', () => {
    render(<Panels />)
    expect([line('agents'), line('stats'), line('mission')]).toEqual([LOADING, LOADING, LOADING])
  })

  it('answers the roster, its counts and one running Mission with its steps', () => {
    giveSampleData()
    render(<Panels />)
    expect(line('agents').split(', ')).toEqual(expect.arrayContaining(['Scout', 'Quill']))
    expect(line('stats')).toBe('2 of 4 active')
    expect(line('mission')).toBe('mission running: Compare three laptops and write a shortlist, step 2 of 3')
    expect(host.pageAsks().map((ask) => ask.hook)).toEqual(['useAgents', 'useAgentStats', 'useActivityFeed'])
  })

  it('is given by the harness page before it draws the mock host', () => {
    const main = readFileSync(MAIN, 'utf8')
    const drawHost = main.slice(main.indexOf('function drawHost('))
    expect(drawHost.indexOf('giveSampleData()')).toBeGreaterThan(0)
    expect(drawHost.indexOf('giveSampleData()')).toBeLessThan(drawHost.indexOf('root.render('))
  })
})
