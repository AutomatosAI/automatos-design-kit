// @vitest-environment node
// PRD-268 (SDK 1.3.0): the proactive stand-ins held to the vendored declarations beyond what tsc checks
// (test/types.test.ts holds every name's type, test/surface.test.ts the names): the row states, the brief's sections,
// Hide's reasons, Try again's kinds, the colour roles and an approval's answers are the declared unions, in their
// order, and DISPLAY_STATE_LABELS has a label for each state, frozen, with the glyphs §6.11.1 fixes. A static read of
// packages/theme-sdk/areas/proactive.d.ts, theme.d.ts and cards.d.ts. SDK 1.4.0: a message part's types (chat.d.ts),
// the brief's ratings and BriefVoice's data-voice-row.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DISPLAY_STATE_LABELS, STATUS_ROLE_TOKENS } from '../src/internal/proactive/labels.ts'
import { RETRIES } from '../src/internal/proactive/props.ts'
import { BRIEF_SECTIONS, DISPLAY_STATES, HIDE_REASONS } from '../src/internal/proactive/wire.ts'
import { BRIEF_PART, REPLY_CHIPS_PART, SUGGESTION_PART, TEXT_PART } from '../src/internal/scripted/message-parts.ts'
import * as fake from '../src/sdk/index.ts'

const SDK_ROOT = dirname(createRequire(import.meta.url).resolve('@automatos/theme-sdk/package.json'))
const QUOTED = /'([a-z_]+)'/g
const AREA = (name: string): string => readFileSync(join(SDK_ROOT, 'areas', `${name}.d.ts`), 'utf8')

/** The quoted members of one declared union type, in its order. */
function union(area: string, name: string): string[] {
  const line = AREA(area).split('\n').find((text) => text.startsWith(`export type ${name} =`)) ?? ''
  return Array.from(line.matchAll(QUOTED), (match) => match[1])
}

describe("the proactive stand-ins' unions are the declared ones", () => {
  it('row states, brief sections, Hide reasons and Try again kinds (areas/proactive.d.ts)', () => {
    expect(union('proactive', 'DisplayState')).toEqual([...DISPLAY_STATES])
    expect(union('proactive', 'BriefSection')).toEqual([...BRIEF_SECTIONS])
    expect(union('proactive', 'HideReason')).toEqual([...HIDE_REASONS])
    expect(union('proactive', 'Retry')).toEqual([...RETRIES])
  })

  it('colour roles (areas/theme.d.ts) and the answers an approval offers (areas/cards.d.ts)', () => {
    expect(union('theme', 'StatusRole')).toEqual(Object.keys(STATUS_ROLE_TOKENS))
    expect(union('cards', 'ApprovalAnswer')).toEqual(['refuse', 'allow_once'])
    expect(union('cards', 'SuggestionCardVariant')).toEqual(['card', 'pinned'])
  })
})

describe('DISPLAY_STATE_LABELS', () => {
  it("is the theme area's name, frozen, a label for each state with §6.11.1's glyph, word and HUD word", () => {
    expect(fake.DISPLAY_STATE_LABELS).toBe(DISPLAY_STATE_LABELS)
    expect(Object.isFrozen(DISPLAY_STATE_LABELS)).toBe(true)
    expect(Object.keys(DISPLAY_STATE_LABELS)).toEqual([...DISPLAY_STATES])
    expect(Object.values(DISPLAY_STATE_LABELS).map((label) => `${label.glyph} ${label.word} / ${label.hudWord}`)).toEqual([
      '◆ Needs you / NEEDS YOU', '● Working / WORKING', '✓ Ready to look at / READY', '✓ Done / DONE', "✕ Couldn't finish / FAILED",
    ])
  })

  it('paints each state by its role\'s Studio token, needs-you in warn-ink on a light ground, never through --accent', () => {
    expect(DISPLAY_STATE_LABELS.needs_you.token).toEqual({ light: '--warn-ink', dark: '--warning' })
    expect(Object.values(STATUS_ROLE_TOKENS).flatMap((token) => [token.light, token.dark])).not.toContain('--accent')
  })
})

describe("BriefVoice's root", () => {
  it('is the one the declarations tell a theme to follow (test/proactive-cards.test.tsx draws it)', () => {
    expect(AREA('voice')).toContain('[data-brief-voice="root"]')
    expect(AREA('voice')).toContain('data-voice-speaking="true"')
  })
})

describe('SDK 1.4.0: what the stand-ins follow', () => {
  it("a message part's four types (areas/chat.d.ts), the brief's ratings up and down, and BriefVoice's data-voice-row", () => {
    const partTypes = Array.from(AREA('chat').matchAll(/readonly type: '([^']+)'/g), (match) => match[1])
    expect(partTypes).toEqual(expect.arrayContaining([TEXT_PART, BRIEF_PART, SUGGESTION_PART, REPLY_CHIPS_PART]))
    expect(AREA('chat')).toContain('export type HostMessagePart = HostTextPart | HostBriefPart | HostSuggestionPart | HostReplyChipsPart')
    expect(union('proactive', 'BriefRating')).toEqual(['up', 'down'])
    expect(AREA('voice')).toContain('data-voice-row="<index>"')
  })
})
