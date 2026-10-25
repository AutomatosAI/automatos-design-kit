// @vitest-environment node
// Play 1.1.1: one page frame. The pages had two left insets (56px on the chat and Conversations, 40px on the shelf,
// the Look page, the style sheet and the frame's header) and two title sizes (the hero size on the shelf and the Look
// page, the status size elsewhere). Now every page starts space-6 in, under the header's search, and a page's h1 has
// one size, --pl-text-status. A static check of the stylesheets' text (css: false).
import { describe, expect, it } from 'vitest'
import { declaredFor } from '../support/rule-values.ts'

const INSET = 'var(--pl-space-6)'
const PAGE_TITLE = 'var(--pl-text-status)'

/** Each page's outer box, by stylesheet and selector: whose left padding is the page's inset. */
const PAGE_BOXES: readonly (readonly [string, string])[] = [
  ['components/play/shell/play-frame.module.css', '.header'],
  ['components/play/shell/play-frame.module.css', '.page'],
  ['components/play/shell/page-columns.module.css', '.pageHeader'],
  ['components/play/chat/chat.module.css', '.messages'],
  ['components/play/chat/composer.module.css', '.footer'],
  ['components/play/conversations/conversations.module.css', '.body'],
  ['components/play/deliverables/shelf.module.css', '.page'],
  ['components/play/deliverables/deliverable-detail.module.css', '.page'],
  ['components/looks/looks.module.css', '.main'],
  ['components/looks/style/style.module.css', '.page'],
]

/** Each page's h1, by stylesheet and selector. */
const PAGE_TITLES: readonly (readonly [string, string])[] = [
  ['components/play/shell/page-columns.module.css', ':global(html.play) .pageTitle'],
  ['components/play/conversations/conversations.module.css', ':global(html.play) .title'],
  ['components/play/deliverables/shelf.module.css', ':global(html.play) .title'],
  ['components/looks/looks.module.css', ':global(html.play) .heading'],
  ['components/looks/style/style.module.css', ':global(html.play) .heading'],
]

/** The left value of a padding shorthand (one to four values). */
function leftOf(padding: string | undefined): string | undefined {
  const values = padding?.match(/var\([^)]*\)|[^\s]+/g) ?? []
  return [undefined, values[0], values[1], values[1], values[3]][values.length]
}

describe('one page frame (Play 1.1.1)', () => {
  it('reads the left value of a padding shorthand', () => {
    expect(['a', 'a b', 'a b c', 'a b c d', 'var(--x) var(--y)'].map(leftOf)).toEqual(['a', 'b', 'b', 'd', 'var(--y)'])
    expect(leftOf(undefined)).toBeUndefined()
  })

  it.each(PAGE_BOXES)('%s %s starts space-6 in, under the search', (file, selector) => {
    expect(leftOf(declaredFor(file, selector).get('padding'))).toBe(INSET)
  })

  it.each(PAGE_TITLES)("%s %s sets a page's h1 in the one page title size", (file, selector) => {
    expect(declaredFor(file, selector).get('font')).toBe(PAGE_TITLE)
  })
})
