// @vitest-environment node
/**
 * PRD-260 K2, M01, M16, M18, M19, M73 — Play's CSS guards, over the theme's own source (src/).
 *
 * (b) Play's CSS defines and reads only --pl-* variables, plus the core's font
 *     and radius ones: Play's --accent and --ring would clobber Studio's HSL
 *     tokens of the same names.
 * (c) Every visible colour comes from the look: no #hex, no colour function of
 *     numbers (rgb() to oklch() and color(), in color-mix() too) and no named
 *     colour in Play's CSS or components; a system colour only in forced
 *     colours (M96, css-colours.ts). lib/looks/catalogue.ts is the one home
 *     for a literal colour.
 * (d) M01, M16: Play's own type, inline code and sheet colours win over
 *     Studio's element rules, which reach Play's elements because <html>
 *     carries studio and play together. Proven statically (css: false).
 * Then Make it yours on Paper, in forced colours and with a long name (M18, M19, M73).
 *
 * Moved from core's lib/__tests__/prd260-play-guards.test.ts, sections (b), (c), (d) and Make it yours, as
 * they were but for these. The files are the theme's: every stylesheet under src/ and the components under
 * src/components/{play,looks,mascot}, read by test/support/play-css.ts (the guards' readers, moved with them)
 * over core's css-cascade, css-colours and module-references (test/support/, byte for byte). (b): Play reads
 * the host's motion factor --theme-motion (PRD-261 K-19c, docs/PLAY-HISTORY.md's table), the one host variable it may
 * read and never define. (d) compares with core's globals.css rules as test/fixtures/core/
 * studio-element-rules.css holds them (core at 101a0bf33; core's app/__tests__/studio-element-rules-contract
 * .test.ts is the host's side). Make it yours: play-theme.css's forced-colours rings name the wrap twice in
 * the kit (html.play:is(html.play), the same table). Sections (a) (Play is ported, never imported) and (e)
 * (the core's seams load Play's screens on demand) stay core's: its A-19f2 guard,
 * lib/__tests__/prd261-no-theme-in-core.test.ts, replaces them (test/moved-from-core/css.json).
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { readSource, SOURCE_ROOT, THEME_ROOT } from './source-files.ts'
import { compareSpecificity, cssRules, declaredProperties, elementOf } from './support/css-cascade.ts'
import { lastCompound, namesClass, specificity, splitTopLevel } from './support/css-cascade.ts'
import { componentColours, literalColours, splitForcedColours, stylesheetColours } from './support/css-colours.ts'
import { allStyledElements, bodyOf, customProperties, declarations, definedProperties, forcedColoursRules } from './support/play-css.ts'
import { label, located, type PlayRule, playColours, playCssFiles, readProperties, relative } from './support/play-css.ts'
import { rulesForElement, rulesForMarkdown, rulesOf, unique, walk } from './support/play-css.ts'

const SOURCE_FILE = /\.(ts|tsx)$/
const TEST_FILE = /(^|\/)__tests__\/|\.test\.tsx?$/

const PLAY_COMPONENT_DIRS = ['components/play', 'components/looks', 'components/mascot']
const PLAY_THEME_CSS = 'app/play-theme.css'
const PLAY_FONTS_CSS = 'app/play-fonts.css'
/** play-theme.css, play-fonts.css and the 26 CSS modules (README, "Styles and assets"). */
const PLAY_STYLESHEETS_MIN = 28
const CORE_VARS_PLAY_MAY_READ = new Set(['--font-geist-sans', '--font-geist-mono', '--font-newsreader', '--radius'])
/** The host's look runtime's motion factor (PRD-261 K-19c): Play's --pl-motion-scale reads it, only the host sets it. */
const HOST_VARS_PLAY_MAY_READ: ReadonlySet<string> = new Set(['--theme-motion'])
/**
 * Play 1.2.0: the custom properties a theme colours the host's voice button with (the SDK's voice area,
 * areas/voice.d.ts; test/chat/voice-css.test.ts holds the list to it). Play sets them for core's button to read
 * (composer.module.css) and never reads them itself.
 */
const VOICE_BUTTON_VARS: ReadonlySet<string> = new Set([
  '--voice-button-size',
  '--voice-button-radius',
  '--voice-button-bg',
  '--voice-button-fg',
  '--voice-button-active-bg',
  '--voice-button-active-fg',
  '--voice-button-ring',
])
const PLAY_VAR = /^--pl-[\w-]+$/
const CATALOGUE = 'lib/looks/catalogue.ts'
const CATALOGUE_MIN_COLOURS = 20

// --- (b) and (c) Play's stylesheets and components ---------------------------------------

function playComponentFiles(): string[] {
  return PLAY_COMPONENT_DIRS.flatMap((dir) => walk(path.join(SOURCE_ROOT, dir), (name) => SOURCE_FILE.test(name)))
    .filter((file) => !TEST_FILE.test(relative(file)))
}

function isPlayVariable(name: string): boolean {
  return PLAY_VAR.test(name) || CORE_VARS_PLAY_MAY_READ.has(name)
}

/**
 * The variables a stylesheet defines or reads that aren't Play's: a host variable Play may read counts only where
 * defined, and the voice button's only where read.
 */
function strayVariables(css: string): string[] {
  const defined = definedProperties(css).filter((name) => !isPlayVariable(name) && !VOICE_BUTTON_VARS.has(name))
  const read = readProperties(css).filter((name) => !isPlayVariable(name) && !HOST_VARS_PLAY_MAY_READ.has(name))
  return [...defined, ...read]
}

describe("PRD-260 (b) — Play's CSS uses only --pl-* variables (K2)", () => {
  it('reads every stylesheet under src/, play-fonts.css and the CSS modules included', () => {
    const sheets = playCssFiles().map(relative)
    expect(sheets).toEqual(expect.arrayContaining([PLAY_THEME_CSS, PLAY_FONTS_CSS]))
    expect(sheets.length).toBeGreaterThanOrEqual(PLAY_STYLESHEETS_MIN)
  })

  it('reads definitions and var() reads, comments ignored', () => {
    // Play 1.2.0: the voice button's properties are set, never read; test/chat/voice-css.test.ts holds them to the SDK.
    expect(strayVariables('.a { --voice-button-bg: red } .b { color: var(--voice-button-fg) } .c { --voice-x: 1px }')).toEqual([
      '--voice-x',
      '--voice-button-fg',
    ])
    const css = '/* --accent: red */ .a { --accent: red; color: var(--ring); --pl-x: 1; font: var( --font-geist-sans ); } .b--c:hover {}'
    expect(customProperties(css)).toEqual(['--accent', '--pl-x', '--ring', '--font-geist-sans'])
    expect(customProperties(css).filter((name) => !isPlayVariable(name))).toEqual(['--accent', '--ring'])
  })

  it("allows the core's font and radius variables and nothing else outside --pl-*", () => {
    for (const name of ['--pl-accent', '--pl-ground-bg', '--font-geist-sans', '--font-geist-mono', '--font-newsreader', '--radius']) {
      expect(isPlayVariable(name)).toBe(true)
    }
    for (const name of ['--accent', '--ring', '--background', '--primary', '--pl', '--font-instrument']) {
      expect(isPlayVariable(name)).toBe(false)
    }
  })

  it("lets Play read the host's motion factor and never define it (PRD-261 K-19c)", () => {
    const css = '.a { --theme-motion: 0; --accent: red } .b { transition-duration: calc(1s * var(--theme-motion, 1)) }'
    expect(strayVariables(css)).toEqual(['--theme-motion', '--accent'])
    expect(readProperties(readSource(PLAY_THEME_CSS))).toContain('--theme-motion')
  })

  it("finds no other variable in Play's stylesheets", () => {
    const bad = playCssFiles().flatMap((file) =>
      strayVariables(fs.readFileSync(file, 'utf8')).map((name) => `${relative(file)}: ${name}`),
    )
    expect(bad).toEqual([])
  })
})

describe('PRD-260 (c) — no literal colours outside the look catalogue', () => {
  it('finds the patterns it is looking for', () => {
    expect(literalColours('color: #FF6A1F; border: 1px solid #fff; fill: #1a0a0280')).toEqual(['#FF6A1F', '#fff', '#1a0a0280'])
    expect(literalColours('it&#39;s #section-2 and #main')).toEqual([])
    expect(literalColours('a: rgba(0,0,0,.4); b: hsl(20 8% 7%); c: rgb( 255 0 0 )')).toHaveLength(3)
    expect(literalColours('a: hsl(var(--x)); b: rgba(var(--pl-y), .5)')).toEqual([])
  })

  it('finds oklch(), lab(), color() and named colours, in color-mix() too; the look, transparent and currentColor pass (M96)', () => {
    const functions = 'a: oklch(0.7 0.19 45); b: oklab(.5 .1 0); c: lab(50% 40 59); d: lch(52 72 50); e: hwb(20 10% 0%); f: color(display-p3 1 .4 .1)'
    expect(literalColours(functions)).toHaveLength(6)
    expect(literalColours('a: oklch(from var(--pl-accent) l c h / 50%); b: color(from var(--pl-x) srgb r g b)')).toEqual([])
    const named = '.a { color: white; border: 1px solid RebeccaPurple; background: color-mix(in srgb, black 10%, transparent) }'
    expect(stylesheetColours(named)).toEqual(['white', 'RebeccaPurple', 'black'])
    const look = [
      '.a { color: currentColor; background: color-mix(in srgb, var(--pl-accent) 30%, transparent);',
      'font: 600 1rem/1.2 var(--font-geist-sans), sans-serif; transform: rotate(calc(tan(45deg) * 1turn)) }',
      '.b::after { content: "red" } .c:hover { background: url(/auto/white.png) }',
    ].join('\n')
    expect(stylesheetColours(look)).toEqual([])
  })

  it('allows a system colour only inside @media (forced-colors: active) (M96, P260-FX-19)', () => {
    const css = '.a { outline: 2px solid Highlight } @media (forced-colors: active) { .b { outline-color: CanvasText; color: white } }'
    expect(splitForcedColours(css).inside).toHaveLength(1)
    expect(stylesheetColours(css)).toEqual(['Highlight', 'white'])
  })

  it("reads a component's style values and paint attributes, never its copy (M96)", () => {
    const source = [
      "const ring = { color: 'white', borderColor: 'currentColor', '--pl-glow': 'gold' }",
      "const mark = <svg><path fill=\"tomato\" stroke={'transparent'} /></svg>",
      "const copy = <p title='Auto turned red'>Pick a black ground</p>",
      "const look = { name: 'Gold', accent: 'molten' }",
    ].join('\n')
    expect(componentColours('sample.tsx', source)).toEqual(['white', 'gold', 'tomato'])
  })

  it("has no literal colour in Play's stylesheets or components", () => {
    const files = [...playCssFiles(), ...playComponentFiles()]
    const found = files.flatMap((file) => playColours(file).map((colour) => `${relative(file)}: ${colour}`))
    expect(found).toEqual([])
  })

  it('keeps the catalogue as the place the colours live', () => {
    const catalogue = readSource(CATALOGUE)
    expect(literalColours(catalogue).length).toBeGreaterThan(CATALOGUE_MIN_COLOURS)
  })
})

// --- (d) the cascade on Play's elements ---------------------------------------------------

/** Core's globals.css rules that reach Play's elements, as core had them at 101a0bf33 (test/fixtures/core/). */
const STUDIO_RULES_CSS = path.join(THEME_ROOT, 'test', 'fixtures', 'core', 'studio-element-rules.css')
const SHEET_CSS = 'components/play/deliverables/deliverable-content.module.css'
const PLAY_PREFIX = ':global(html.play)'
/** The elements Studio's element rules restyle: headings, keyboard keys and inline code. */
const GUARDED_TAGS = new Set(['h1', 'h2', 'kbd', 'code'])
const CHIP_TAGS = new Set(['kbd', 'code'])
/** A code block's code: Studio's chip rule (code:not(pre code)) never reaches it. */
const INSIDE_PRE = /(?:^|[\s>+~])pre(?![\w-])/
const MARKDOWN_RENDERER = 'MarkdownView'
/** 7 h1, 16 h2, 1 kbd and 2 code carried a module class on 15 Oct (the review fix plan, P260-FX-01). */
const GUARDED_ELEMENTS_MIN = 26
/** The Deliverable sheet and Auto's reply. */
const MARKDOWN_SURFACES_MIN = 2
const SHEET_FOCUS = /--pl-focus-outline\s*:[^;]*var\(\s*--pl-color-sheet-accent\s*\)/
/** Studio's chip rule sets all four, so Play's inline kbd and code rules set each (either name). */
const CHIP_PROPERTIES = [['background', 'background-color'], ['padding'], ['border-radius'], ['font', 'font-size']]
/** Studio's element rules in globals.css: they reach every Play element, since <html> carries studio. */
const STUDIO_ELEMENT_RULES: Readonly<Record<string, readonly string[]>> = {
  h1: ['.studio h1'],
  h2: ['.studio h2'],
  kbd: ['.studio kbd'],
  code: ['.studio code', '.studio code:not(pre code)'],
}
/** The core markdown's rules in globals.css: they reach the elements inside a MarkdownView. */
const MARKDOWN_ELEMENT_RULES: Readonly<Record<string, readonly string[]>> = {
  h1: ['.md-view h1', '.studio .md-view h1'],
  h2: ['.md-view h2', '.studio .md-view h2'],
  h3: ['.md-view h3', '.studio .md-view h3'],
  code: ['.md-view code', '.md-view pre code'],
  a: ['.md-view a', '.studio .md-view a'],
  strong: ['.md-view strong'],
}

function guardedRules(): PlayRule[] {
  const elements = allStyledElements(playComponentFiles())
  return [
    ...elements.filter((element) => GUARDED_TAGS.has(element.tag)).flatMap(rulesForElement),
    ...elements.filter((element) => element.tag === MARKDOWN_RENDERER).flatMap(rulesForMarkdown),
  ]
}

/** The core rules the Play rule ties with or loses to, on the element it lands on. */
function outrankedBy(rule: PlayRule): string[] {
  const own = specificity(rule.selector)
  const markdown = rule.inMarkdown ? (MARKDOWN_ELEMENT_RULES[rule.tag] ?? []) : []
  return [...(STUDIO_ELEMENT_RULES[rule.tag] ?? []), ...markdown].filter((core) => compareSpecificity(own, specificity(core)) <= 0)
}

/** Inline kbd and code: the chip properties none of the rules for that target sets. */
function missingChipProperties(rules: readonly PlayRule[]): string[] {
  const declared = new Map<string, Set<string>>()
  for (const rule of rules.filter((each) => CHIP_TAGS.has(each.tag) && !INSIDE_PRE.test(each.selector))) {
    const key = `${relative(rule.css)}: ${lastCompound(rule.selector)}`
    declared.set(key, new Set([...(declared.get(key) ?? []), ...declaredProperties(rule.body)]))
  }
  return Array.from(declared).flatMap(([key, names]) =>
    CHIP_PROPERTIES.filter((either) => !either.some((name) => names.has(name))).map((either) => `${key} sets no ${either.join('/')}`),
  )
}

describe("PRD-260 (d) — Play's own type, inline code and sheet colours win over Studio's element rules (M01, M16)", () => {
  it('reads rules, selector lists and specificity', () => {
    const css = '@tailwind base; /* .x { } */ .a, .b:is(.c, .d) { color: red } @media (min-width: 1px) { .e h1 { margin: 0 } } @keyframes k { from { opacity: 0 } }'
    expect(cssRules(css).map((rule) => rule.selectors)).toEqual([['.a', '.b:is(.c, .d)'], ['.e h1']])
    expect(splitTopLevel(':global(html.play) .x,\n  .y  z')).toEqual([':global(html.play) .x', '.y z'])
    expect(lastCompound(':global(html.play) .prose > :first-child')).toBe(':first-child')
    expect(elementOf(lastCompound('.prose li::marker'))).toBe('li')
    expect(namesClass('.titleRow', 'title')).toBe(false)
    expect(declaredProperties(' font: var(--x); --pl-y: 1px ;')).toEqual(['font', '--pl-y'])
    expect(INSIDE_PRE.test('.prose pre code')).toBe(true)
    expect(INSIDE_PRE.test('.pre-wrap code')).toBe(false)
    expect(specificity('.studio h1')).toEqual([0, 1, 1])
    expect(specificity('.studio code:not(pre code)')).toEqual([0, 1, 3])
    expect(specificity('.studio .md-view a')).toEqual([0, 2, 1])
    expect(specificity(':global(html.play) .title')).toEqual([0, 2, 1])
    expect(specificity(":global(html.play) .item[data-newest='true'] .cardTitle")).toEqual([0, 4, 1])
    expect(specificity(':where(html.play :focus-visible)')).toEqual([0, 0, 0])
    expect(specificity('.prose li::marker')).toEqual([0, 1, 2])
  })

  it("finds the core rules it compares against in globals.css (core's copy in test/fixtures/core)", () => {
    const core = new Set(rulesOf(STUDIO_RULES_CSS).map(({ selector }) => selector))
    const named = [...Object.values(STUDIO_ELEMENT_RULES), ...Object.values(MARKDOWN_ELEMENT_RULES)].flat()
    expect(named.filter((selector) => !core.has(selector))).toEqual([])
  })

  it("finds Play's headings, keys and inline code, and both markdown surfaces", () => {
    const elements = allStyledElements(playComponentFiles())
    expect(elements.filter((element) => GUARDED_TAGS.has(element.tag)).length).toBeGreaterThanOrEqual(GUARDED_ELEMENTS_MIN)
    expect(elements.filter((element) => element.tag === MARKDOWN_RENDERER).length).toBeGreaterThanOrEqual(MARKDOWN_SURFACES_MIN)
  })

  it('starts every rule on those elements, and every markdown-surface rule, with html.play', () => {
    expect(unique(guardedRules().filter((rule) => !rule.selector.startsWith(PLAY_PREFIX)).map(label))).toEqual([])
  })

  it('outranks every globals.css rule that reaches the same element (.studio h1, .studio code:not(pre code), .studio .md-view a)', () => {
    const lost = guardedRules().flatMap((rule) => outrankedBy(rule).map((core) => `${label(rule)} does not beat ${core}`))
    expect(unique(lost)).toEqual([])
  })

  it("sets the background, padding, radius and size of inline kbd and code itself, since Studio's chip sets all four", () => {
    expect(missingChipProperties(guardedRules())).toEqual([])
  })

  it("draws the keyboard ring on the Deliverable sheet in the sheet's accent (M16)", () => {
    const sheet = rulesOf(path.join(SOURCE_ROOT, SHEET_CSS)).find(({ selector }) => selector === '.document')
    expect(sheet?.body).toMatch(SHEET_FOCUS)
  })
})

// --- (e) Make it yours on Paper, in forced colours and with a long name ---------------------
//
// M18: the raw accents fall below 3:1 on Paper (1.07:1 for cream to 2.94:1 for rose), so a
// pressed or current state is marked in the accent as text, and an accent swatch has an edge
// of its own. M19: forced colours (Windows High Contrast) drop box-shadows and repaint
// backgrounds, so the colour samples opt out, pressed edges widen, every pressed control is
// ringed in Highlight, and no focus style hides the outline behind a box-shadow ring. M73: a
// long look name wraps instead of squeezing the heading or being clipped in its card.

const EDITOR_CSS = 'components/looks/editor.module.css'
const LOOKS_CSS = 'components/looks/looks.module.css'
const STYLE_CSS = 'components/looks/style/style.module.css'
/** A rule on a pressed or current state: it marks what is chosen, or where you are. */
const STATE_SELECTOR = /\[aria-(?:pressed|current)\b/
/** The raw accent (--pl-accent, --pl-color-accent): not its text colour, ink or a tint. */
const RAW_ACCENT = /var\(\s*--pl-(?:color-)?accent\s*[,)]/
/** Play's CSS held 8 rules on a pressed or current state on 15 Oct. */
const STATE_RULES_MIN = 8
/** `outline: none` or `0`, `outline-style: none`, `outline-width: 0`: no ring forced colours could draw. */
const HIDDEN_OUTLINE: Readonly<Record<string, RegExp>> = {
  outline: /^(?:none|0(?:px)?)(?:\s*!important)?$/,
  'outline-style': /^none\b/,
  'outline-width': /^0(?:px)?\b/,
}
/** The colour samples, file by file: each keeps its own colour in forced colours. */
const COLOUR_SAMPLES: Readonly<Record<string, readonly string[]>> = {
  [EDITOR_CSS]: ['.swatch', '.groundSwatch', '.dot', '.lightDot'],
  [LOOKS_CSS]: ['.cardTop', '.cardLight', '.cardAccent'],
  [STYLE_CSS]: ['.swatchChip', '.step'],
}
/** The pressed edges forced colours widen (their ring is a box-shadow, which forced colours drop). */
const WIDENED_IN_FORCED_COLOURS: Readonly<Record<string, readonly string[]>> = {
  [EDITOR_CSS]: ['.option[aria-pressed="true"]', '.typeOption[aria-pressed="true"]', '.chip[aria-pressed="true"]'],
  [LOOKS_CSS]: ['.card[aria-pressed="true"]'],
}
const PRESSED_EDGE_MIN_PX = 2
/** play-theme.css's forced-colours ring on a pressed control: the kit names the wrap twice (docs/PLAY-HISTORY.md's table). */
const PRESSED_ANYWHERE = 'html.play:is(html.play) [aria-pressed="true"]'

function hidesOutline(body: string): boolean {
  const declared = declarations(body)
  return Object.entries(HIDDEN_OUTLINE).some(([property, hidden]) => hidden.test(declared.get(property) ?? ''))
}

describe('PRD-260 (e) — Make it yours on Paper, in forced colours and with a long name (M18, M19, M73)', () => {
  it('reads declarations, forced-colours blocks, hidden outlines and the raw accent', () => {
    const css = ".a { color: red } @media (forced-colors: active) { .b[aria-pressed='true'] { border-width: 2px } } @media (min-width: 1px) { .c { outline: none } }"
    expect(forcedColoursRules(css).map((rule) => rule.selectors)).toEqual([[".b[aria-pressed='true']"]])
    expect(bodyOf(forcedColoursRules(css), '.b[aria-pressed="true"]')).toContain('border-width')
    expect(declarations(' outline: 2px  solid transparent; outline-offset: 2px ').get('outline')).toBe('2px solid transparent')
    expect(['outline: none', 'outline:0', 'outline-style: none', 'outline-width: 0px'].map(hidesOutline)).toEqual([true, true, true, true])
    expect(['outline: 2px solid transparent', 'outline-offset: 0', 'outline: var(--pl-focus-outline)'].map(hidesOutline)).toEqual([false, false, false])
    expect(['var(--pl-color-accent)', 'var( --pl-accent , red)'].map((value) => RAW_ACCENT.test(value))).toEqual([true, true])
    expect(['var(--pl-color-accent-text)', 'var(--pl-accent-ink)', 'var(--pl-tint-accent-line)'].map((value) => RAW_ACCENT.test(value))).toEqual([false, false, false])
  })

  it('marks every pressed and current state in the accent as text, never the raw accent (M18)', () => {
    const states = playCssFiles().flatMap((file) =>
      cssRules(fs.readFileSync(file, 'utf8'))
        .filter((rule) => rule.selectors.some((selector) => STATE_SELECTOR.test(selector)))
        .map((rule) => ({ file, rule })),
    )
    expect(states.length).toBeGreaterThanOrEqual(STATE_RULES_MIN)
    expect(states.filter(({ rule }) => RAW_ACCENT.test(rule.body)).map(({ file, rule }) => located(file, rule))).toEqual([])
  })

  it('draws the glow slider in the accent as text, and edges every accent swatch in text2 under the chosen ring (M18)', () => {
    const rules = cssRules(readSource(EDITOR_CSS))
    expect(declarations(bodyOf(rules, '.slider')).get('accent-color')).toBe('var(--pl-color-accent-text)')
    expect(declarations(bodyOf(rules, '.swatch')).get('box-shadow')).toBe('inset 0 0 0 1px var(--pl-color-text-2)')
    expect(declarations(bodyOf(rules, '.swatch[aria-pressed="true"]')).get('box-shadow')).toBe(
      '0 0 0 2px var(--pl-color-text), inset 0 0 0 1px var(--pl-color-text-2)',
    )
  })

  it('keeps every colour sample in its own colours in forced colours (M19)', () => {
    const adjusted = Object.entries(COLOUR_SAMPLES).flatMap(([file, selectors]) => {
      const rules = cssRules(readSource(file))
      return selectors
        .filter((selector) => declarations(bodyOf(rules, selector)).get('forced-color-adjust') !== 'none')
        .map((selector) => `${file}: ${selector}`)
    })
    expect(adjusted).toEqual([])
  })

  it('widens the chosen option and look card in forced colours and rings every pressed control in Highlight (M19)', () => {
    const narrow = Object.entries(WIDENED_IN_FORCED_COLOURS).flatMap(([file, selectors]) => {
      const rules = forcedColoursRules(readSource(file))
      return selectors
        .filter((selector) => !(Number.parseFloat(declarations(bodyOf(rules, selector)).get('border-width') ?? '') >= PRESSED_EDGE_MIN_PX))
        .map((selector) => `${file}: ${selector}`)
    })
    expect(narrow).toEqual([])
    const theme = forcedColoursRules(readSource(PLAY_THEME_CSS))
    const pressed = declarations(bodyOf(theme, PRESSED_ANYWHERE))
    expect(pressed.get('outline')).toBe('2px solid Highlight')
    expect(pressed.get('outline-offset')).toBe('2px')
    expect(declarations(bodyOf(theme, `${PRESSED_ANYWHERE}:focus-visible`)).get('outline-width')).toBe('4px')
    const swatchFocus = declarations(bodyOf(forcedColoursRules(readSource(EDITOR_CSS)), '.swatch:focus-visible'))
    expect(swatchFocus.get('outline-color')).toBe('CanvasText')
  })

  it("never hides the outline in Play's, the looks' or Auto's CSS: forced colours drop the box-shadow ring in its place (M19)", () => {
    const hidden = playCssFiles().flatMap((file) =>
      cssRules(fs.readFileSync(file, 'utf8'))
        .filter((rule) => hidesOutline(rule.body))
        .map((rule) => located(file, rule)),
    )
    expect(hidden).toEqual([])
  })

  it("lets a long look name wrap: the status column shrinks to 40% and the card's text breaks (M73)", () => {
    const rules = cssRules(readSource(LOOKS_CSS))
    const side = declarations(bodyOf(rules, '.headerSide'))
    expect(side.get('flex')).toBe('0 1 auto')
    expect(side.get('min-width')).toBe('0')
    expect(side.get('max-width')).toBe('40%')
    expect(declarations(bodyOf(rules, '.status')).get('overflow-wrap')).toBe('break-word') // between words first (Play 1.1.1)
    const text = declarations(bodyOf(rules, '.cardText'))
    expect(text.get('min-width')).toBe('0')
    expect(text.get('overflow-wrap')).toBe('anywhere')
  })
})
