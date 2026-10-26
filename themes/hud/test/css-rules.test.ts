// @vitest-environment node
// HUD's layout and control rules that jsdom never applies, read from the stylesheets as written: every box measured
// with its border and padding whatever the host's reset, the phone frame's page width, menu and tap targets, 40 px
// under the message box's keys at the core screen's foot, the phone core screen's controls, dock and sizes, the voice
// button's place, size and colours on the phone and the desktop (the press never moving while the host's control opens
// under it), the waveform's bars, Pause Auto on the opaque ground beside the core's state chip, and the empty chat's
// line and starters in the message box's hint and HUD's secondary button. A rule is found by its selector, comments
// out and whitespace collapsed.
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

describe('the phone frame', () => {
  it('gives a page the whole width, padded 16 px, on the design phone\'s 32 px grid and 320 by 320 glow', () => {
    expect(ruleBody('frame/frame.module.css', '.frame[data-layout="phone"] .page')).toBe(
      'padding: var(--hud-space-4) var(--hud-space-4) var(--hud-space-5);',
    )
    const phone = ruleBody('frame/frame.module.css', '.frame[data-layout="phone"]')
    expect(phone).toContain('--hud-grid-size: 32px;')
    expect(phone).toContain('--hud-glow-ellipse: 320px 320px;')
  })

  it('draws nothing of the menu while it is shut, whatever its display says, and lays it over the page when open', () => {
    expect(ruleBody('frame/nav-drawer.module.css', '.layer[hidden]')).toBe('display: none;')
    expect(ruleBody('frame/nav-drawer.module.css', '.layer')).toContain('position: fixed;')
    expect(ruleBody('frame/nav-drawer.module.css', '.glass')).toContain('background: var(--hud-drawer);')
    expect(ruleBody('frame/nav-drawer.module.css', '.drawer')).toContain('overflow-y: auto;')
  })

  it("keeps MENU and Close at the design's 44 px tap targets", () => {
    expect(ruleBody('frame/top-bar.module.css', '.menu')).toContain('min-height: var(--hud-tap-min);')
    const close = ruleBody('frame/nav-drawer.module.css', '.close')
    expect(close).toContain('width: var(--hud-tap-min);')
    expect(close).toContain('height: var(--hud-tap-min);')
  })
})

describe('the core screen', () => {
  it("leaves 40 px under the message box's keys at its foot", () => {
    expect(ruleBody('chat/screen.module.css', '.screen')).toContain('padding: 20px var(--hud-space-5) var(--hud-space-6);')
    expect(ruleBody('app/hud-theme.css', 'html.hud')).toContain('--hud-space-6: 40px;')
  })
})

describe('the phone core screen', () => {
  it("keeps TYPE and STOP at the row's two ends at the design's 64 by 44 px, the voice button's 84 px circle between", () => {
    const controls = ruleBody('chat/phone/phone.module.css', '.controls')
    expect(controls).toContain('display: grid;')
    expect(controls).toContain('grid-template-columns: 64px minmax(0, 1fr) 64px;')
    expect(controls).toContain('--hud-voice-circle: 84px;')
    const buttons = ruleBody('chat/phone/phone.module.css', '.type, .stop')
    expect(buttons).toContain('min-width: 64px;')
    expect(buttons).toContain('min-height: var(--hud-tap-min);')
    expect(buttons).toContain('grid-row: 1;')
    expect(buttons).toContain('align-self: center;')
    expect(ruleBody('chat/phone/phone.module.css', '.type')).toContain('grid-column: 1;')
    expect(ruleBody('chat/phone/phone.module.css', '.stop')).toContain('grid-column: 3;')
  })

  it("holds the strip under the circle at the host's control's height, so the press never moves as it opens", () => {
    const controls = ruleBody('chat/phone/phone.module.css', '.controls')
    expect(controls).toContain('--hud-voice-strip: 28px;')
    expect(controls).toContain('grid-template-rows: var(--hud-voice-circle) minmax(var(--hud-voice-strip), auto);')
    const voice = ruleBody('chat/phone/phone.module.css', '.voice')
    expect(voice).toContain('grid-area: 1 / 2 / 3 / 3;')
    expect(voice).toContain('align-items: center;')
  })

  it("draws the voice button as the design's circle through the host's --voice-button-* properties", () => {
    const voice = ruleBody('chat/phone/phone.module.css', '.voice')
    expect(voice).toContain('--voice-button-size: var(--hud-voice-circle);')
    expect(voice).toContain('--voice-button-radius: 50%;')
    expect(voice).toContain('--voice-button-bg: var(--hud-accent-fill);')
    expect(voice).toContain('--voice-button-fg: var(--hud-accent-text);')
    expect(voice).toContain('--voice-button-active-bg: var(--hud-accent);')
    expect(voice).toContain('--voice-button-active-fg: var(--hud-accent-ink);')
    const press = ruleBody('chat/phone/phone.module.css', '.voice [data-voice-button="press"]')
    expect(press).toContain('border: 2px solid var(--hud-accent);')
    expect(ruleBody('chat/phone/phone.module.css', '.voice [data-voice-button="press"]:focus-visible')).toContain(
      'outline: 2px solid var(--hud-accent-text);',
    )
  })

  it('pins the dock to the foot on the opaque ground while the screen scrolls as one', () => {
    expect(ruleBody('chat/phone/phone.module.css', '.screen')).toContain('overflow-y: auto;')
    const dock = ruleBody('chat/phone/phone.module.css', '.dock')
    expect(dock).toContain('position: sticky;')
    expect(dock).toContain('bottom: 0;')
    expect(dock).toContain('background: var(--hud-bg);')
  })

  it('centres the last exchange in its room, and sits it at the foot over the waveform while a voice session runs (1.1.1)', () => {
    expect(ruleBody('chat/phone/phone.module.css', '.exchange')).toContain('justify-content: center;')
    expect(ruleBody('chat/phone/phone.module.css', '.exchange[data-voice="true"]')).toBe('justify-content: flex-end;')
  })

  it("sets your words at 15 px in the secondary text and Auto's reply the whole width at 19 px, AUTO for a screen reader", () => {
    expect(ruleBody('chat/phone/phone.module.css', '.quote')).toContain('font: 400 15px/1.5 var(--hud-font-text);')
    expect(ruleBody('chat/phone/phone.module.css', '.quote')).toContain('color: var(--hud-text-2);')
    const reply = ruleBody('chat/transcript.module.css', '.row[data-layout="phone"]')
    expect(reply).toContain('--hud-row-auto: 19px;')
    expect(reply).toContain('grid-template-columns: minmax(0, 1fr);')
    expect(ruleBody('chat/transcript.module.css', '.row[data-layout="phone"] .speaker')).toContain('clip-path: inset(50%);')
  })
})

describe('the desktop transcript', () => {
  it('fades its top edge over the padding that keeps its first row clear, so a row scrolled under it is never cut (1.1.1)', () => {
    const scroller = ruleBody('chat/transcript.module.css', '.scroller')
    const fade = 'linear-gradient(to bottom, transparent, var(--hud-text) var(--hud-transcript-fade))'
    expect(scroller).toContain('--hud-transcript-fade: 24px;')
    expect(scroller).toContain('padding-top: var(--hud-transcript-fade);')
    expect(scroller).toContain(`-webkit-mask-image: ${fade};`)
    expect(scroller).toContain(` mask-image: ${fade};`)
    expect(scroller).toContain('overflow-y: auto;')
  })
})

describe('the desktop voice deck', () => {
  it('stands the voice button between the waveform halves, its cell the press wide and spanning the strip', () => {
    const deck = ruleBody('voice/voice-deck.module.css', '.deck')
    expect(deck).toContain('grid-template-columns: minmax(0, 1fr) var(--hud-voice-press) minmax(0, 1fr);')
    expect(deck).toContain('grid-template-rows: var(--hud-voice-press) minmax(var(--hud-voice-strip), auto);')
    expect(deck).toContain('--hud-voice-press: var(--hud-tap-min);')
    expect(deck).toContain('--hud-voice-strip: 28px;')
    const press = ruleBody('voice/voice-deck.module.css', '.press')
    expect(press).toContain('grid-area: 1 / 2 / 3 / 3;')
    expect(press).toContain('justify-content: center;')
    expect(press).toContain('--voice-button-size: var(--hud-voice-press);')
    expect(press).toContain('--voice-button-ring: var(--hud-accent-text);')
    expect(ruleBody('voice/voice-deck.module.css', '.hint')).toContain('grid-area: 2 / 1 / 3 / 4;')
    expect(ruleBody('voice/voice-deck.module.css', '.press [data-voice-button="press"]:focus-visible')).toContain(
      'outline: 2px solid var(--hud-accent-text);',
    )
  })
})

describe('the waveform', () => {
  it("draws each bar at its design height and opacity, at rest a quarter of it, scaled from its middle", () => {
    const bar = ruleBody('voice/waveform.module.css', '.bar')
    expect(bar).toContain('height: calc(var(--hud-wave-height) * var(--hud-bar));')
    expect(bar).toContain('opacity: calc(0.35 + 0.65 * var(--hud-bar));')
    expect(bar).toContain('transform: scaleY(var(--hud-wave-rest));')
    expect(bar).toContain('transform-origin: center;')
    expect(ruleBody('voice/waveform.module.css', '.wave')).toContain('--hud-wave-rest: 0.25;')
    expect(ruleBody('voice/waveform.module.css', '.wave')).toContain('--hud-wave-height: 44px;')
    expect(ruleBody('voice/waveform.module.css', '.wave[data-size="small"]')).toContain('--hud-wave-height: 36px;')
  })

  it('animates nothing itself: only the frame loop moves it, where motion is allowed', () => {
    expect(readSource('voice/waveform.module.css')).not.toMatch(/\banimation\b|@keyframes|transition/)
  })
})

describe('MIC LIVE', () => {
  it("is the design's chip on the desktop and the accent words on the phone, its status on no pixel", () => {
    const mic = ruleBody('voice/mic-live.module.css', '.mic')
    expect(mic).toContain('border: 1px solid var(--hud-accent-line);')
    expect(mic).toContain('color: var(--hud-accent-text);')
    expect(mic).toContain('text-transform: uppercase;')
    expect(ruleBody('voice/mic-live.module.css', '.mic[data-layout="phone"]')).toContain('margin-left: auto;')
    expect(ruleBody('voice/mic-live.module.css', '.said')).toContain('position: absolute;')
  })
})

describe('the Conversations page', () => {
  it("sets its one-word heading at 40 px on the desktop and no larger than a 360 px phone's window holds", () => {
    expect(ruleBody('conversations/conversations.module.css', '.heading')).toContain('font-size: clamp(28px, 7vw, 40px);')
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
