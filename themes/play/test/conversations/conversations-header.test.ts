// @vitest-environment node
// Play 1.1.1: the Conversations title row guards a long title. New chat keeps its size and its one line, the title is
// cut with an ellipsis instead of pushing it out, and the mascot column (the chat's and Conversations') is
// clamp(240px, 26vw, 340px), not a fixed 340px that squeezed the list's column on a 1024 to 1280 px window.
// A static check of the stylesheets' text (css: false).
import { describe, expect, it } from 'vitest'
import { declaredFor, tokenValue } from '../support/rule-values.ts'

const CONVERSATIONS_CSS = 'components/play/conversations/conversations.module.css'

describe("Conversations' title row with a long title (Play 1.1.1)", () => {
  it('keeps New chat whole: no shrinking, one line', () => {
    const newChat = declaredFor(CONVERSATIONS_CSS, '.newChat')
    expect([newChat.get('flex'), newChat.get('white-space')]).toEqual(['none', 'nowrap'])
  })

  it('cuts the title with an ellipsis in what is left', () => {
    const title = declaredFor(CONVERSATIONS_CSS, ':global(html.play) .title')
    expect([title.get('min-width'), title.get('overflow'), title.get('text-overflow'), title.get('white-space')]).toEqual([
      '0', 'hidden', 'ellipsis', 'nowrap',
    ])
  })

  it("narrows the mascot column with the window: 240px to 340px, 26% of the window's width between", () => {
    expect(tokenValue('app/play-theme.css', '--pl-mascot-column-width')).toBe('clamp(240px, 26vw, 340px)')
    expect(declaredFor('components/play/shell/page-columns.module.css', '.mascotColumn').get('width')).toBe('var(--pl-mascot-column-width)')
  })
})
