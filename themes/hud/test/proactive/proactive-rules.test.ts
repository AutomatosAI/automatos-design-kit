// HUD 1.2.0 (PRD-268): the proactive surfaces' pure rules and their stylesheets (jsdom applies no CSS, so the rules
// are read from the files). BRIEFING's sections in Brief@1's order, every row numbered across them as Listen numbers
// them, the brief's labels with the SDK's defaults behind them, where each row opens; a state's glyph, HUD word and
// tone (the readable accent, the error colour for failed, the secondary text for the quiet ones; never --accent); the
// Missions with the ones that need you first; what folds BRIEFING. And the styles: MISSIONS' 3 px rail in the readable
// accent while working, never animated; one entrance per surface, once, only under data-hud-enter; nothing loops.
// HUD 1.3.0 (SDK 1.4.0): what a message's parts show (its brief, its suggestions, the reply chips under the newest
// message alone, the suggestions on screen NEXT skips), a row's place in Auto's reading, the kept thumb read back
// safely; and the styles: a row still to come not drawn, rows building in by a transition under data-build alone, the
// SAY chips and the thumbs as HUD's 44 px outline buttons, nothing through --accent.
import { type BriefOpensType, chatHref, DISPLAY_STATE_LABELS, missionHref, QUESTIONS_HREF, ticketHref } from '@automatos/theme-sdk'
import { describe, expect, it } from 'vitest'
import {
  BRIEF_SECTIONS, briefDay, briefRowHref, briefSections, briefSuggestionIds, emptyLine, EMPTY_BRIEF, rowNumber, rowTime,
  SECTION_LABELS, SETTINGS_HREF, startsSuggestion,
} from '../../src/chat/briefing/brief-rows.ts'
import { foldsOn } from '../../src/chat/briefing/use-fold.ts'
import { NOT_READ, readingAt, rowReading } from '../../src/chat/briefing/use-reading.ts'
import { nextOf, openSuggestion } from '../../src/chat/next/use-next.ts'
import { missionsInOrder, READINESS_MARKS, readinessMark, STATE_TONES, stateMark } from '../../src/chat/panels/status-marks.ts'
import {
  briefOfMessage, latestReplyChips, replyChipsOf, suggestionIdsOf, suggestionsOnScreen, threadSuggestionIds,
} from '../../src/chat/thread/message-parts.ts'
import { readSource } from '../support/files.ts'
import { CHIPS, hostMessage } from './parts.ts'
import { BRIEF, briefRow, mission, OTHER_SUGGESTION_ID, SUGGESTION_ID, SUGGESTIONS } from './support.ts'

const COMMENT = /\/\*[\s\S]*?\*\//g
const FLAT_RULE = /([^{}]+)\{([^{}]*)\}/g
const PROACTIVE_STYLES = [
  'chat/briefing/briefing.module.css', 'chat/next/next.module.css', 'chat/panels/panels.module.css', 'chat/thread/thread.module.css',
]

function rules(rel: string): { readonly selector: string; readonly body: string }[] {
  const css = readSource(rel).replace(COMMENT, ' ')
  return Array.from(css.matchAll(FLAT_RULE), (match) => ({ selector: match[1].trim(), body: match[2] }))
}

function ruleBody(rel: string, selector: string): string {
  return rules(rel).find((rule) => rule.selector === selector)?.body ?? ''
}

describe("BRIEFING's sections", () => {
  it("keeps Brief@1's order, skips an empty section, and numbers every row across them as Listen reads them", () => {
    expect(BRIEF_SECTIONS).toEqual(['needs_you', 'suggestions', 'today', 'since', 'unchecked'])
    const shown = briefSections(BRIEF)
    expect(shown.map((section) => section.section)).toEqual(['needs_you', 'suggestions', 'today'])
    expect(shown.flatMap((section) => section.rows.map((row) => row.number))).toEqual([1, 2, 3, 4])
    expect(shown.map((section) => section.count)).toEqual([7, 1, 1])
  })

  it('carries a folded section as the brief does: its exact count over the rows it shows, and nothing to open', () => {
    const [needsYou] = briefSections(BRIEF)
    expect(needsYou.count).toBe(BRIEF.counts.needs_you)
    expect(needsYou.rows.map((row) => row.row)).toEqual(BRIEF.sections.needs_you)
    expect(Object.keys(needsYou).sort()).toEqual(['count', 'label', 'rows', 'section'])
  })

  it("takes each label from the brief, the SDK's default where it leaves one out, and counts unchecked rows itself", () => {
    const unchecked = briefRow({ id: 'u1', title: 'Calendar', why: 'No calendar is connected.' })
    const brief = { ...BRIEF, sections: { ...BRIEF.sections, unchecked: [unchecked] }, labels: { sections: {}, more: {} } }
    const shown = briefSections(brief)
    expect(shown.map((section) => section.label)).toEqual([
      SECTION_LABELS.needs_you, SECTION_LABELS.suggestions, SECTION_LABELS.today, SECTION_LABELS.unchecked,
    ])
    expect(SECTION_LABELS).toEqual({
      needs_you: 'Needs you', suggestions: 'Suggested', today: 'Today', since: 'Since your last brief', unchecked: "Couldn't check",
    })
    expect(shown[3].count).toBe(1)
    expect(shown[3].rows[0].number).toBe(5)
    expect(emptyLine(brief)).toBe(EMPTY_BRIEF)
  })

  it('opens each row where it is answered, and a suggestion or a malformed id nowhere', () => {
    const at = (type: BriefOpensType, id: string) => briefRowHref(briefRow({ id: 'r', title: 'Row', opens: { type, id } }))
    expect(at('ticket', '101')).toBe(ticketHref('101'))
    expect(at('question', '301')).toBe(QUESTIONS_HREF)
    expect(at('mission', 'm-9')).toBe(missionHref('m-9'))
    expect(at('mission', '../admin')).toBeNull()
    expect(at('chat', 'c-1')).toBe(chatHref('c-1'))
    expect(at('deliverable', 'd-42')).toBe('/deliverables?deliverable=d-42')
    expect(at('settings', 'calendar')).toBe(SETTINGS_HREF)
    expect(at('suggestion', 'x')).toBeNull()
    expect(briefRowHref(briefRow({ id: 'r', title: 'Row' }))).toBeNull()
  })

  it('lists the suggestions BRIEFING carries with their own Start, and none without a brief', () => {
    expect(briefSuggestionIds(BRIEF)).toEqual([SUGGESTION_ID])
    expect(briefSuggestionIds(null)).toEqual([])
  })

  it("starts only a suggestion's row whose action is Start", () => {
    const [suggested] = BRIEF.sections.suggestions
    expect(startsSuggestion(suggested)).toBe(suggested.opens?.id)
    expect(startsSuggestion(BRIEF.sections.needs_you[0])).toBeNull()
    expect(startsSuggestion({ ...suggested, action: { verb: 'hide', label: 'Hide' } })).toBeNull()
  })

  it("says the brief's day, a row's time and its number in HUD's words, and leaves what it can't read as it is", () => {
    expect(briefDay('2026-10-14')).toBe('Wed 14 Oct')
    expect(briefDay('someday')).toBe('someday')
    expect(rowTime(new Date(2026, 9, 14, 9, 5).toISOString())).toBe('09:05')
    expect(rowTime('not a time')).toBeNull()
    expect(rowTime(null)).toBeNull()
    expect(rowNumber(3)).toBe('03')
    expect(rowNumber(12)).toBe('12')
  })
})

describe('a state as HUD draws it', () => {
  it("is the SDK's glyph and HUD word, in the readable accent but done (quiet) and failed (the error colour)", () => {
    expect(STATE_TONES).toEqual({ needs_you: 'live', working: 'live', ready: 'live', done: 'quiet', failed: 'failed' })
    for (const state of Object.keys(STATE_TONES) as (keyof typeof STATE_TONES)[]) {
      const label = DISPLAY_STATE_LABELS[state]
      expect(stateMark(state)).toEqual({ glyph: label.glyph, word: label.hudWord, tone: STATE_TONES[state] })
    }
    expect(stateMark('stuck')).toBeNull()
    expect(stateMark(null)).toBeNull()
    expect(stateMark(undefined)).toBeNull()
  })

  it('draws a readiness item as ✓ READY, ○ NOT CHECKED or ◆ NEEDS SETUP, a person must act only on the last', () => {
    expect(READINESS_MARKS).toEqual({
      ready: { glyph: '✓', word: 'READY', tone: 'quiet' },
      not_checked: { glyph: '○', word: 'NOT CHECKED', tone: 'quiet' },
      needs_setup: { glyph: '◆', word: 'NEEDS SETUP', tone: 'live' },
    })
    expect(readinessMark('broken')).toBeNull()
  })

  it('lists the Missions that need you first, the rest in the order the host gave', () => {
    const list = [
      mission({ id: 'a', goal: 'A', display_state: 'working' }),
      mission({ id: 'b', goal: 'B', display_state: 'needs_you' }),
      mission({ id: 'c', goal: 'C' }),
      mission({ id: 'd', goal: 'D', display_state: 'needs_you' }),
    ]
    expect(missionsInOrder(list).map((item) => item.id)).toEqual(['b', 'd', 'a', 'c'])
    expect(list.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('what folds BRIEFING', () => {
  /** A press dispatched at `target`, as the page's listener reads it afterwards (its target set). */
  function press(type: 'keydown' | 'pointerdown', target: Element, key?: string): Event {
    const event = type === 'keydown' ? new KeyboardEvent(type, { key, bubbles: true }) : new Event(type, { bubbles: true })
    target.dispatchEvent(event)
    return event
  }

  it('is a press outside it, or Escape anywhere; never Tab, a modifier, or a press inside it', () => {
    const panel = document.createElement('div')
    const inside = document.createElement('button')
    const outside = document.createElement('button')
    panel.append(inside)
    document.body.append(panel, outside)
    expect(foldsOn(press('pointerdown', outside), panel)).toBe(true)
    expect(foldsOn(press('keydown', outside, 'a'), panel)).toBe(true)
    expect(foldsOn(press('keydown', inside, 'Escape'), panel)).toBe(true)
    expect(foldsOn(press('pointerdown', inside), panel)).toBe(false)
    expect(foldsOn(press('keydown', inside, 'Enter'), panel)).toBe(false)
    expect(foldsOn(press('keydown', outside, 'Tab'), panel)).toBe(false)
    expect(foldsOn(press('keydown', outside, 'Shift'), panel)).toBe(false)
    panel.remove()
    outside.remove()
  })
})

describe('the stylesheets', () => {
  it("draw MISSIONS' rail as a still 3 px line in the readable accent while a Mission works", () => {
    const rail = ruleBody('chat/panels/panels.module.css', '.mission[data-rail="true"]')
    expect(rail).toContain('box-shadow: inset 3px 0 0 var(--hud-accent-text);')
    expect(rail).not.toMatch(/\banimation|\btransition/)
  })

  it('paint every status in the readable accent or the error colour, never through --accent', () => {
    for (const rel of PROACTIVE_STYLES) {
      expect(readSource(rel)).not.toMatch(/var\(--accent\b/)
    }
    expect(ruleBody('chat/briefing/briefing.module.css', '.status[data-tone="live"]')).toContain('color: var(--hud-accent-text);')
    expect(ruleBody('chat/briefing/briefing.module.css', '.status[data-tone="failed"]')).toContain('color: var(--hud-error-text);')
  })

  it('enter each surface once, a fade and a 4 px rise over 180 ms, only under data-hud-enter, and loop nothing', () => {
    const entrances = [
      ['chat/briefing/briefing.module.css', '.briefing[data-hud-enter="rise"]', 'hud-briefing-enter'],
      ['chat/next/next.module.css', '.next[data-hud-enter="rise"]', 'hud-next-enter'],
    ] as const
    for (const [rel, selector, name] of entrances) {
      expect(ruleBody(rel, selector)).toContain(`animation: ${name} 180ms ease-out 1 both;`)
      const animated = rules(rel).filter((rule) => /\banimation\s*:/.test(rule.body))
      expect(animated.map((rule) => rule.selector)).toEqual([selector])
      expect(readSource(rel)).toContain('transform: translateY(4px);')
      expect(readSource(rel)).not.toMatch(/infinite/)
    }
  })
})

describe("what a message's parts show (HUD 1.3.0)", () => {
  const brief = { type: 'brief@1', brief: BRIEF } as const
  const card = (id: string) => ({ type: 'suggestion@1', suggestion_id: id }) as const
  const chips = { type: 'reply_chips@1', replies: CHIPS } as const

  it("finds the brief by its part, the suggestions by theirs, each once in order, and the chips Auto offered", () => {
    const posted = hostMessage('m1', 'assistant', [{ type: 'text', text: BRIEF.prose }, brief])
    expect(briefOfMessage(posted)).toBe(BRIEF)
    expect(briefOfMessage(hostMessage('m2', 'assistant', [{ type: 'text', text: BRIEF.prose }]))).toBeNull()
    const answer = hostMessage('m3', 'assistant', [card(OTHER_SUGGESTION_ID), card(SUGGESTION_ID), card(OTHER_SUGGESTION_ID), chips])
    expect(suggestionIdsOf(answer)).toEqual([OTHER_SUGGESTION_ID, SUGGESTION_ID])
    expect(replyChipsOf(answer)).toEqual(CHIPS)
    expect(replyChipsOf(posted)).toEqual([])
  })

  it("offers the chips under the conversation's newest message alone, while it is Auto's and written", () => {
    const answer = hostMessage('a1', 'assistant', [chips])
    expect(latestReplyChips([hostMessage('u1', 'user'), answer])).toEqual({ id: 'a1', chips: CHIPS })
    expect(latestReplyChips([answer, hostMessage('u2', 'user')])).toBeNull()
    expect(latestReplyChips([answer, hostMessage('a2', 'assistant')])).toBeNull()
    expect(latestReplyChips([{ ...answer, writing: true }])).toBeNull()
    expect(latestReplyChips([])).toBeNull()
  })

  it('lists the suggestions on screen with their own Start: BRIEFING\'s, and the cards and briefs of the messages drawn', () => {
    const thread = [hostMessage('b', 'assistant', [brief]), hostMessage('a', 'assistant', [card(OTHER_SUGGESTION_ID)])]
    expect(threadSuggestionIds(thread)).toEqual([SUGGESTION_ID, OTHER_SUGGESTION_ID])
    expect(suggestionsOnScreen(null, [])).toEqual([])
    expect(suggestionsOnScreen(BRIEF, [])).toEqual([SUGGESTION_ID])
    expect(suggestionsOnScreen(BRIEF, [thread[1]])).toEqual([SUGGESTION_ID, OTHER_SUGGESTION_ID])
  })

  it("shows NEXT the newest open suggestion not on screen, and a card its own one only while it is open", () => {
    expect(nextOf(SUGGESTIONS, [], [SUGGESTION_ID])?.id).toBe(OTHER_SUGGESTION_ID)
    expect(openSuggestion(SUGGESTIONS, [], OTHER_SUGGESTION_ID)?.id).toBe(OTHER_SUGGESTION_ID)
    expect(openSuggestion(SUGGESTIONS, [OTHER_SUGGESTION_ID], OTHER_SUGGESTION_ID)).toBeNull()
    expect(openSuggestion([{ ...SUGGESTIONS[0], status: 'hidden' }], [], SUGGESTION_ID)).toBeNull()
    expect(openSuggestion(SUGGESTIONS, [], 'not-listed')).toBeNull()
  })
})

describe("a row's place in Auto's reading (HUD 1.3.0)", () => {
  it('is now for the row read, read up to the furthest reached, ahead after it; only now where nothing may move', () => {
    const reached = readingAt(readingAt(readingAt(NOT_READ, 1), null), 0)
    expect(reached).toEqual({ now: 0, reached: 1 })
    expect([0, 1, 2].map((index) => rowReading(reached, index, true))).toEqual(['now', 'read', 'ahead'])
    expect([0, 1, 2].map((index) => rowReading(reached, index, false))).toEqual(['now', undefined, undefined])
    expect([0, 1].map((index) => rowReading(NOT_READ, index, true))).toEqual(['ahead', 'ahead'])
  })
})

describe('the stylesheets of 1.3.0', () => {
  it("leave a row still to come undrawn, and build rows in by a transition under data-build alone, never an animation", () => {
    const css = 'chat/briefing/briefing.module.css'
    expect(ruleBody(css, '.row[data-reading="ahead"]')).toContain('visibility: hidden;')
    const moving = rules(css).filter((rule) => /\btransition\s*:/.test(rule.body))
    expect(moving.map((rule) => rule.selector)).toEqual(['.rows[data-build="true"] .row'])
    expect(moving[0]?.body).toContain('transition: opacity 180ms ease-out, transform 180ms ease-out;')
    expect(ruleBody(css, '.marker')).toContain('color: var(--hud-accent-text);')
  })

  it("draw the SAY chips and the thumbs as HUD's 44 px outline buttons, and nothing in the thread moves", () => {
    for (const [css, selector] of [['chat/thread/thread.module.css', '.reply'], ['chat/briefing/briefing.module.css', '.thumb']] as const) {
      const body = ruleBody(css, selector)
      expect(body).toContain('min-height: var(--hud-tap-min);')
      expect(body).toContain('border: 1px solid var(--hud-accent-line);')
      expect(body).toContain('border-radius: 0;')
    }
    expect(readSource('chat/thread/thread.module.css')).not.toMatch(/\banimation|\btransition/)
  })
})
