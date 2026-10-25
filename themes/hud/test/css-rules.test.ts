// @vitest-environment node
// HUD's layout and control rules that jsdom never applies, read from the stylesheets as written: every box measured
// with its border and padding whatever the host's reset, and 40 px under the message box's keys at the core screen's
// foot. A rule is found by its selector, comments out and whitespace collapsed.
import { describe, expect, it } from 'vitest'
import { readSource } from './support/files.ts'

const COMMENT = /\/\*[\s\S]*?\*\//g
/** A rule with no nested block: its selector and its declarations. */
const FLAT_RULE = /([^{}]+)\{([^{}]*)\}/g

const collapse = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** The declarations of the first rule in `rel` whose selector is `selector`, whitespace collapsed. */
function ruleBody(rel: string, selector: string): string {
  const css = readSource(rel).replace(COMMENT, ' ')
  for (const match of css.matchAll(FLAT_RULE)) {
    if (collapse(match[1]) === selector) return collapse(match[2])
  }
  throw new Error(`${rel} has no rule for ${selector}`)
}

describe('the frame', () => {
  it("measures every box with its border and padding, so HUD's sizes hold whatever the host's reset", () => {
    const body = ruleBody('app/hud-theme.css', ':where(html.hud) *, :where(html.hud) *::before, :where(html.hud) *::after')
    expect(body).toBe('box-sizing: border-box;')
  })
})

describe('the core screen', () => {
  it("leaves 40 px under the message box's keys at its foot", () => {
    expect(ruleBody('chat/screen.module.css', '.screen')).toContain('padding: 20px var(--hud-space-5) var(--hud-space-6);')
    expect(ruleBody('app/hud-theme.css', 'html.hud')).toContain('--hud-space-6: 40px;')
  })
})
