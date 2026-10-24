// @vitest-environment node
// What stops the LOOK page's motion, read from the stylesheets (jsdom applies no CSS): the preview animates its rings
// and its pulse only under data-motion="on", with keyframes of its own named hud-…; each animated part carries
// data-hud-loop in the markup; and HUD's global stylesheet pauses every data-hud-loop with the look's motion off and
// ends every animation under the host's data-theme-motion="reduce" and the OS setting, outranking every module rule.
import { describe, expect, it } from 'vitest'
import { readSource, sourceStyles } from '../support/files.ts'

const COMMENT = /\/\*[\s\S]*?\*\//g
/** A rule with no nested block: its selector and its declarations (keyframe steps included). */
const FLAT_RULE = /([^{}]+)\{([^{}]*)\}/g
const ANIMATION = /\banimation(?:-name)?\s*:/
const MOVING = '[data-motion="on"]'

function rules(css: string): { readonly selector: string; readonly body: string }[] {
  return Array.from(css.replace(COMMENT, ' ').matchAll(FLAT_RULE), (match) => ({ selector: match[1].trim(), body: match[2] }))
}

const PREVIEW_CSS = readSource('looks/preview.module.css')
const PREVIEW_TSX = readSource('looks/look-preview.tsx')
const THEME_CSS = readSource('app/hud-theme.css').replace(COMMENT, ' ')

describe("the LOOK page's motion", () => {
  it('animates the preview only while it may move', () => {
    const animated = rules(PREVIEW_CSS).filter((rule) => ANIMATION.test(rule.body))
    expect(animated.length).toBe(4)
    expect(animated.filter((rule) => !rule.selector.includes(MOVING)).map((rule) => rule.selector)).toEqual([])
  })

  it('names each keyframes hud-… and defines it in the module that uses it', () => {
    const defined = Array.from(PREVIEW_CSS.matchAll(/@keyframes\s+([\w-]+)/g), (match) => match[1])
    const used = Array.from(PREVIEW_CSS.matchAll(/animation:\s*([\w-]+)/g), (match) => match[1])
    expect(defined.every((name) => name.startsWith('hud-'))).toBe(true)
    expect([...new Set(used)].filter((name) => !defined.includes(name))).toEqual([])
  })

  it('marks every animated part of the preview as a loop the motion rule can stop', () => {
    const animatedClasses = rules(PREVIEW_CSS)
      .filter((rule) => ANIMATION.test(rule.body))
      .map((rule) => /\.(\w+)\s*$/.exec(rule.selector)?.[1] ?? '')
    for (const name of animatedClasses) {
      expect(PREVIEW_TSX).toMatch(new RegExp(String.raw`styles\.${name}\}\`\}? data-hud-loop=|styles\.${name}\} data-hud-loop=`))
    }
  })

  it("is stopped by HUD's global rules: the look's motion, the host's data-theme-motion and the OS setting", () => {
    expect(THEME_CSS).toMatch(/html\.hud:not\(#hud-none\) \[data-hud-loop\][^{]*\{\s*animation-play-state: var\(--hud-motion, running\);/)
    expect(THEME_CSS).toMatch(/html\.hud:not\(#hud-none\)\[data-theme-motion="reduce"\] \*[^{]*\{\s*animation-duration: 0\.01ms;\s*animation-iteration-count: 1;/)
    expect(THEME_CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
  })

  it('leaves no other module of the look screens animating', () => {
    const others = sourceStyles().filter((rel) => /^(?:looks|style)\//.test(rel) && rel !== 'looks/preview.module.css')
    expect(others.length).toBeGreaterThan(0)
    expect(others.filter((rel) => rules(readSource(rel)).some((rule) => ANIMATION.test(rule.body)))).toEqual([])
  })
})
