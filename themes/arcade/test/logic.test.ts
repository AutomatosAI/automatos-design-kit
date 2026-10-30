// @vitest-environment node
// Arcade's pure parts: the sprite engine (twelve states of two to four frames, inside 32 by 32), the map (its markers
// on grass in their own region, the same tile for the same id), the dialogue's typing (the design's speeds, capped
// for long replies), what the dialogue box says, the party's state words, the quests' regions and steps, the
// Inventory's words, and the pause menu's groups. The rows are made up.
import type { ActivityFeed, Deliverable, HostChatMessage, Mission, NeedsYou, RosterAgent } from '@automatos/theme-sdk'
import { describe, expect, it } from 'vitest'

import { MASCOT_STATES } from '@automatos/mascot/types'

import { AUTO_SIZE } from '../src/art/auto-sprite.ts'
import { SPRITE_STATES } from '../src/art/states.ts'
import { MAP_RECTS, placeMarkers, regionAt, tileAt } from '../src/art/world-map.ts'
import { needyNames, partyOf, workingIds } from '../src/chat/party-rows.ts'
import { GREETING, portraitState, sayingOf, wordsOf, YOUR_MOVE } from '../src/chat/saying.ts'
import { typedAfter, TYPE_CAP_TICKS } from '../src/chat/typewriter.ts'
import { countLine, filtersOf, itemDate, itemKind, TABS, typeWord } from '../src/deliverables/inventory.ts'
import { activeMenuId, buildMenu } from '../src/frame/menu.ts'
import { missionStatus, questCount } from '../src/quests/quests.ts'

const STAMP = '2026-10-14T09:00:00+00:00'

function message(fields: Partial<HostChatMessage> & Pick<HostChatMessage, 'id' | 'role'>): HostChatMessage {
  return {
    text: '', activity: [], error: null, writing: false, stopped: false, receipts: null, above: [], deliverables: [], approvals: [],
    taskCards: [], toolCalls: [], provenance: null, savedError: null, limitReached: null, reasoningChars: 0, withdrawOffer: null,
    linkedDeliverables: [], ...fields,
  }
}

describe('the sprite engine', () => {
  it("draws Auto's twelve states, each a loop of two to four frames inside 32 by 32", () => {
    expect(SPRITE_STATES.map((state) => state.name)).toEqual([...MASCOT_STATES])
    SPRITE_STATES.forEach((state) => {
      expect(state.frames.length).toBeGreaterThanOrEqual(2)
      expect(state.frames.length).toBeLessThanOrEqual(4)
      state.frames.flat().forEach((run) => {
        expect(run.x + run.width).toBeLessThanOrEqual(AUTO_SIZE)
        expect(run.y).toBeLessThan(AUTO_SIZE)
      })
    })
  })

  it('draws each frame of a state differently, so the loop moves', () => {
    SPRITE_STATES.forEach((state) => {
      const drawn = new Set(state.frames.map((frame) => JSON.stringify(frame)))
      expect(drawn.size, state.name).toBeGreaterThan(1)
    })
  })
})

describe('the map', () => {
  it('is drawn once, every rect inside its 320 by 192 pixels', () => {
    expect(MAP_RECTS.length).toBeGreaterThan(100)
    MAP_RECTS.forEach((rect) => {
      expect(rect.x + rect.width).toBeLessThanOrEqual(320)
      expect(rect.y + rect.height).toBeLessThanOrEqual(192)
    })
  })

  it('puts each marker on grass in its own region, on the same tile for the same id', () => {
    const items = [
      ...Array.from({ length: 8 }, (_, index) => ({ id: `a-${index}`, region: 'active' as const })),
      ...Array.from({ length: 5 }, (_, index) => ({ id: `n-${index}`, region: 'needs' as const })),
      ...Array.from({ length: 5 }, (_, index) => ({ id: `d-${index}`, region: 'done' as const })),
    ]
    const placed = placeMarkers(items)
    items.forEach(({ id, region }) => {
      const spot = placed.get(id)
      expect(spot, id).toBeDefined()
      expect(regionAt(spot!.tx, spot!.ty)).toBe(region)
      expect(tileAt(spot!.tx, spot!.ty)).toBe('grass')
    })
    expect(new Set([...placed.values()].map((spot) => `${spot.tx},${spot.ty}`)).size).toBe(items.length)
    expect(placeMarkers(items).get('n-3')).toEqual(placed.get('n-3'))
  })
})

describe('the typing', () => {
  it("types one character a tick on Normal and one every three on Slow; Instant is whole", () => {
    expect(typedAfter(10, 40, 'normal')).toBe(10)
    expect(typedAfter(30, 40, 'slow')).toBe(10)
    expect(typedAfter(0, 40, 'instant')).toBe(40)
  })

  it('finishes a long reply within the cap', () => {
    expect(typedAfter(TYPE_CAP_TICKS.normal, 5000, 'normal')).toBe(5000)
    expect(typedAfter(TYPE_CAP_TICKS.slow, 5000, 'slow')).toBe(5000)
  })
})

describe('what the dialogue box says', () => {
  it('greets, thinks, says the newest reply, or says it is your move', () => {
    expect(wordsOf(sayingOf([], false))).toBe(GREETING)
    expect(sayingOf([message({ id: 'u1', role: 'user', text: 'Hi' })], true).kind).toBe('thinking')
    expect(wordsOf(sayingOf([message({ id: 'u1', role: 'user', text: 'Hi' })], false))).toBe(YOUR_MOVE)
    const reply = message({ id: 'a1', role: 'assistant', text: 'Hello.' })
    expect(wordsOf(sayingOf([message({ id: 'u1', role: 'user' }), reply], false))).toBe('Hello.')
    expect(sayingOf([message({ id: 'a2', role: 'assistant', writing: true })], true).kind).toBe('thinking')
  })

  it("follows the host's voice session while it listens or thinks", () => {
    expect(portraitState('idle', 'listening')).toBe('listening')
    expect(portraitState('working', 'idle')).toBe('working')
  })
})

describe('the party', () => {
  const agent = (id: number, name: string): RosterAgent => ({
    id, name, description: null, agent_type: 'research_analyst', status: 'active', premium_icon: null, created_at: STAMP, updated_at: STAMP,
  })
  it('says NEEDS YOU by a Needs-you row naming the agent, WORKING by a working run, else IDLE', () => {
    const needs = { total: 1, counts: { review: 1, question: 0, approval: 0, stuck: 0, failed: 0 }, rows: {
      review: [{ ticket_id: 1, title: 'Check it', agent_name: ' scout ', mission_id: null, at: STAMP }], question: [], approval: [], stuck: [], failed: [],
    } } satisfies NeedsYou
    const feed = { total: 1, limit: 1, offset: 0, items: [{ id: 'r', type: 'task', name: 'x', status: 'running', started_at: null, completed_at: null,
      duration_seconds: null, agent: null, agents: [{ id: 2, name: 'Quill', avatar_url: null }], summary: '', source_id: null, source_url: null,
      trigger: null, error_message: null }] } satisfies ActivityFeed
    const party = partyOf([agent(1, 'Scout'), agent(2, 'Quill'), agent(3, 'Pixel')], needyNames(needs), workingIds(feed))
    expect(party.map((member) => [member.name, member.state, member.role])).toEqual([
      ['Scout', 'needs', 'Research analyst'], ['Quill', 'working', 'Research analyst'], ['Pixel', 'idle', 'Research analyst'],
    ])
  })
})

describe('the quests', () => {
  it("puts a Mission in its state's region, with a glyph and a word", () => {
    const state = (value: Mission['state']) => missionStatus({ state: value })
    expect([state('running').region, state('awaiting_human').region, state('failed').region, state('completed').region])
      .toEqual(['active', 'needs', 'needs', 'done'])
    expect(state('failed')).toMatchObject({ glyph: '✕', word: 'Failed' })
    expect(questCount(1)).toBe('1 quest')
  })
})

describe('the Inventory', () => {
  const item = (fields: Partial<Deliverable>) => ({ artifact_type: 'document', source_type: 'chat', ...fields })
  it('draws each item by its type, a social post as a post', () => {
    expect(itemKind(item({ artifact_type: 'report' }))).toBe('report')
    expect(itemKind(item({ artifact_type: 'video' }))).toBe('image')
    expect(itemKind(item({ source_type: 'social_post' }))).toBe('post')
    expect(typeWord(item({ artifact_type: 'blog_post' }))).toBe('Blog post')
  })

  it("asks the host's feed for a tab's type, and dates an item as the design does", () => {
    expect(filtersOf(TABS[1]).artifact_type).toBe('report')
    expect(filtersOf(TABS[4]).source_type).toBe('social_post')
    const now = new Date('2026-10-14T18:00:00')
    expect([itemDate('2026-10-14T09:00:00', now), itemDate('2026-10-13T09:00:00', now), itemDate('2026-10-02T09:00:00', now)])
      .toEqual(['Today', 'Yesterday', '2 Oct'])
    expect(countLine(1)).toBe('1 item · newest first')
  })
})

describe('the pause menu', () => {
  it("names the host's Chat and Deliverables as Arcade's own, and the page on screen", () => {
    const nav = {
      primary: [
        { id: 'chat', label: 'Chat', description: null, href: '/chat', group: 'OPERATIONS', external: false },
        { id: 'agents', label: 'Agents', description: null, href: '/agents', group: 'WORKFORCE', external: false },
        { id: 'deliverables', label: 'Deliverables', description: null, href: '/deliverables', group: 'WORKSPACE', external: false },
      ],
      footer: [{ id: 'settings', label: 'Settings', description: null, href: '/settings', group: null, external: false }],
    }
    expect(buildMenu(nav).map((group) => group.items.map((entry) => entry.label))).toEqual([
      ['Chat', 'Quests', 'Inventory'], ['Agents', 'Settings'], ['Options', 'Sprite gallery'],
    ])
    expect([activeMenuId('/deliverables'), activeMenuId('/looks/style'), activeMenuId('/x/quests')])
      .toEqual(['arcade-inventory', 'arcade-sprites', 'arcade-quests'])
  })
})
