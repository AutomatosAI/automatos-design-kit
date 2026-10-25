// @vitest-environment node
// HUD's layout and control rules that jsdom never applies, read from the stylesheets as written: every box measured
// with its border and padding whatever the host's reset, 40 px under the message box's keys at the core screen's
// foot, Pause Auto on the opaque ground beside the core's state chip, and the empty chat's line and starters in the
// message box's hint and HUD's secondary button. A rule is found by its selector, comments out and whitespace
// collapsed.
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

describe('Pause Auto', () => {
  it('stands on the opaque ground, pressed or not, so no ring shows through it', () => {
    expect(ruleBody('mascot/hud-auto.module.css', '.pause')).toContain('background: var(--hud-bg);')
    expect(ruleBody('mascot/hud-auto.module.css', '.pause[aria-pressed="true"]')).toMatch(/background: [^;]*, var\(--hud-bg\);/)
  })

  it('sits in a row with the state chip over the ring\'s foot, not under Auto', () => {
    const row = ruleBody('chat/voice-core.module.css', '.chipRow')
    expect(row).toContain('bottom: var(--hud-core-chip-bottom);')
    expect(ruleBody('chat/voice-core.module.css', '.chip')).not.toContain('position: absolute')
    expect(ruleBody('chat/voice-core.module.css', '.chip')).toContain('min-width: 0;')
  })

  it('shares a row as wide as the core with the chip, centred, so the two fit side by side', () => {
    const row = ruleBody('chat/voice-core.module.css', '.chipRow')
    expect(row).toContain('left: var(--hud-space-2);')
    expect(row).toContain('right: var(--hud-space-2);')
    expect(row).toContain('justify-content: center;')
    expect(ruleBody('mascot/hud-auto.module.css', '.pause')).toContain('flex: none;')
  })
})

describe('the empty chat', () => {
  it("sets its line as the message box's key hint: mono capitals, tracked", () => {
    const line = ruleBody('chat/empty-chat.module.css', '.line')
    expect(line).toContain('font: 500 12px/1.5 var(--hud-font-mono);')
    expect(line).toContain('letter-spacing: var(--hud-tracking-chip);')
    expect(line).toContain('text-transform: uppercase;')
    expect(ruleBody('chat/composer.module.css', '.hint')).toContain('letter-spacing: var(--hud-tracking-chip);')
  })

  it("draws each starter as HUD's secondary button: an accent-line outline, square, 44 px high", () => {
    const starter = ruleBody('chat/empty-chat.module.css', '.starter')
    expect(starter).toContain('border: 1px solid var(--hud-accent-line);')
    expect(starter).toContain('border-radius: 0;')
    expect(starter).toContain('min-height: var(--hud-tap-min);')
  })
})

describe('a panel', () => {
  it("sets its header's value in capitals, as its label is, so DELIVERABLES' All reads ALL", () => {
    expect(ruleBody('components/panel.module.css', '.value')).toContain('text-transform: uppercase;')
    expect(ruleBody('components/panel.module.css', '.title')).toContain('text-transform: uppercase;')
  })
})

describe('the style sheet', () => {
  it('wraps a name or a value only between its parts, never inside a number', () => {
    const code = ruleBody('style/style.module.css', '.code, .value')
    expect(code).toContain('overflow-wrap: normal;')
    expect(code).toContain('word-break: normal;')
    expect(code).not.toContain('anywhere')
  })
})

describe('the LOOK drawer', () => {
  it('lays its looks out in a grid that wraps, cards at least 96 px wide, none cut at the edge', () => {
    const row = ruleBody('looks/drawer.module.css', '.row')
    expect(row).toContain('display: grid;')
    expect(row).toContain('grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));')
    expect(row).not.toContain('overflow-x')
    expect(ruleBody('looks/drawer.module.css', '.card')).toContain('width: 100%;')
  })

  it('draws its sliders itself in WebKit and Firefox: the track in the look\'s track colour, a square accent thumb', () => {
    expect(ruleBody('looks/drawer.module.css', '.slider')).toContain('appearance: none;')
    for (const track of ['.slider::-webkit-slider-runnable-track', '.slider::-moz-range-track']) {
      expect(ruleBody('looks/drawer.module.css', track)).toContain('background: var(--hud-track);')
    }
    for (const thumb of ['.slider::-webkit-slider-thumb', '.slider::-moz-range-thumb']) {
      const body = ruleBody('looks/drawer.module.css', thumb)
      expect(body).toContain('background: var(--hud-accent);')
      expect(body).toContain('border-radius: 0;')
    }
  })
})

describe('the message box', () => {
  it('draws Send, with nothing to send, as an outline in the line colour, its word in the secondary text, not faded', () => {
    const disabled = ruleBody('chat/composer.module.css', '.send:disabled')
    expect(disabled).toContain('border: 1px solid var(--hud-line);')
    expect(disabled).toContain('background: transparent;')
    expect(disabled).toContain('color: var(--hud-text-2);')
    expect(disabled).toContain('opacity: 1;')
  })
})
