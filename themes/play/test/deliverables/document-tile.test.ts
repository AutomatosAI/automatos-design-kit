// @vitest-environment node
// Play 1.1.1: a document's tile on Daylight. The printed sheet (white) sat on a white card or tile with no edge, so it
// vanished. Each of the three tiles (the shelf card's sheet, the Deliverable card in a reply, the Look page's preview
// card) now draws a 1px inset edge in the ground's line, which reads on a light ground and stays faint on a dark one.
// A static check of the stylesheets' text (css: false).
import { describe, expect, it } from 'vitest'
import { declaredFor } from '../support/rule-values.ts'

const SHEET_EDGE = 'inset 0 0 0 1px var(--pl-line)'
const TILES: readonly (readonly [string, string])[] = [
  ['components/play/deliverables/shelf-card.module.css', '.thumb::before'],
  ['components/play/chat/turn.module.css', '.deliverableTile'],
  ['components/looks/looks.module.css', '.previewTile'],
]

describe("a document's tile on a light ground (Play 1.1.1)", () => {
  it.each(TILES)("%s %s edges the printed sheet in the ground's line", (file, selector) => {
    expect(declaredFor(file, selector).get('box-shadow')).toBe(SHEET_EDGE)
  })
})
