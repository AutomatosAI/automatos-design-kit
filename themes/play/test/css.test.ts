// @vitest-environment node
// Play's stylesheets pass the server's CSS scope check once the preset has wrapped them, and the wrap
// (D2-c: html.play, specificity 0,1,1) keeps Play's cascade: the FX-01 rules keep core's specificity,
// every other module rule gains exactly (0,1,1), and the rules rewritten from core's play-theme.css
// still win where they won in core. A static check: the files are read and transformed, nothing is built.
// PRD-261 K-19c (host 1.1.0): motion stops under the host's look runtime's marker, with no !important.
// PRD-261 K-21 (Play 1.1.1): that marker, data-theme-motion, is the only one; builtin Play's own motion marker
// and motion variable are gone, and the screen heading carries only the host's mark, data-theme-heading.
// PRD-261 E3g: the Pause Auto control, disabled until the host knows the pause flag, looks disabled.
import { readdirSync } from 'node:fs'
import { dirname, join, normalize, relative } from 'node:path'
import { cssScopeErrors, transformThemeCss, wrapSelector } from '@automatos/vite-preset'
import { describe, expect, it } from 'vitest'
import {
  addSpecificity, compareSpecificity, specificity, stripComments, styleRules, withoutGlobal, type Specificity,
} from './css-rules.ts'
import { importSpecifiers, readSource, sourceScripts, SOURCE_ROOT } from './source-files.ts'
import { PLAY_ONLY_HEADING } from '../src/components/looks/screen-heading.ts'

const HTML_CLASS = 'play'
const OPTIONS = { htmlClass: HTML_CLASS, wrap: 'html' } as const
const WRAP_WEIGHT: Specificity = [0, 1, 1]
const THEME_CSS = 'app/play-theme.css'
const FONTS_CSS = 'app/play-fonts.css'
const GLOBAL_STYLESHEETS = [FONTS_CSS, THEME_CSS]
/** 26 CSS modules (Play 1.2.0 added the phone frame's), core's play-theme.css and the kit's play-fonts.css. */
const STYLESHEET_COUNT = 28
/** The FX-01 rules in core start with this (core's frontend/lib/__tests__/prd260-play-guards.test.ts). */
const FX01_PREFIX = ':global(html.play)'
/** Studio's element rules the FX-01 rules must outrank (core's app/globals.css). */
const STUDIO_ELEMENT_RULES = ['.studio h1', '.studio h2', '.studio kbd', '.studio code', '.studio code:not(pre code)']
/** core's forced-colours selectors in app/play-theme.css, before the kit's rewrite. */
const CORE_FORCED_COLOURS = ['html.play [aria-pressed="true"]', 'html.play [aria-pressed="true"]:focus-visible']
const FORCED_COLOURS_MEDIA = '@media (forced-colors: active)'
/** The forced-colours rings set outline, outline-offset and outline-width. */
const OUTLINE = 'outline'
const MOTION_STOP_ID = ':not(#play-none)'
/** The OS setting's three, then the host marker's three. */
const MOTION_STOP_SELECTORS = 6
const REDUCED_MOTION_MEDIA = '@media (prefers-reduced-motion: reduce)'
/** The one marker on <html> that asks for reduced motion: the host's generic one, set by its look runtime (A-19d2). */
const MOTION_MARKER = 'data-theme-motion'
/** Builtin Play's motion marker and variable, set only by its LookProvider in core: gone from Play's CSS (K-21). */
const OLD_MOTION_MARKER = 'data-pl-motion'
const OLD_MOTION_VAR = /--pl-motion(?![\w-])/
/** Builtin Play's heading mark, which only its host in core looked for: gone from Play's source (K-21). */
const OLD_HEADING_MARK = 'data-play-only-heading'
/** What each stop selector reaches under html.play. */
const MOTION_TARGETS = ['*', '*::before', '*::after']
/** The stop's declarations, the OS setting's and each marker's alike. */
const MOTION_STOP: Readonly<Record<string, string>> = {
  'animation-duration': '0.01ms',
  'animation-iteration-count': '1',
  'transition-duration': '0.01ms',
}
/** The Pause Auto control's sheet, and the shelf's, whose Load more sets the look Play gives a disabled button. */
const MASCOT_CSS = 'components/mascot/auto-mascot.module.css'
const SHELF_CSS = 'components/play/deliverables/shelf.module.css'
/** A disabled button while Play waits: a waiting cursor and the second text colour. */
const WAITING_DISABLED: Readonly<Record<string, string>> = { cursor: 'progress', color: 'var(--pl-color-text-2)' }
/** Play's motion factor for calc(): the host's look runtime's variable, 1 when the host sets none. */
const MOTION_SCALE = /--pl-motion-scale:\s*var\(--theme-motion,\s*1\)\s*;/

/** Every stylesheet under src/, relative to src/ with forward slashes. */
function stylesheets(): string[] {
  return readdirSync(SOURCE_ROOT, { encoding: 'utf8', recursive: true })
    .map((rel) => rel.split('\\').join('/'))
    .filter((rel) => rel.endsWith('.css'))
    .sort()
}

/** A stylesheet as the preset's CSS step sees it: CSS modules have lost their :global() first. */
function asBuilt(rel: string): string {
  return rel.endsWith('.module.css') ? withoutGlobal(readSource(rel)) : readSource(rel)
}

/** Every stylesheet a source file imports, resolved relative to src/. */
function importedStylesheets(): Set<string> {
  return new Set(sourceScripts().flatMap((rel) => importSpecifiers(readSource(rel))
    .filter((specifier) => specifier.endsWith('.css'))
    .map((specifier) => relative(SOURCE_ROOT, normalize(join(SOURCE_ROOT, dirname(rel), specifier))).split('\\').join('/'))))
}

interface Selector {
  readonly file: string
  readonly written: string
  readonly within: readonly string[]
  readonly properties: readonly string[]
}

function selectorsOf(rel: string): Selector[] {
  return styleRules(readSource(rel)).flatMap((rule) => rule.selectors.map((written) => ({
    file: rel, written, within: rule.within, properties: rule.properties,
  })))
}

const MODULE_SELECTORS = stylesheets().filter((rel) => rel.endsWith('.module.css')).flatMap(selectorsOf)
const THEME_SELECTORS = selectorsOf(THEME_CSS)

describe("Play's stylesheets", () => {
  it('are the CSS modules the components import plus the two global sheets the entry imports', () => {
    expect(stylesheets()).toHaveLength(STYLESHEET_COUNT)
    expect(Array.from(importedStylesheets()).sort()).toEqual(stylesheets())
    const entryImports = importSpecifiers(readSource('entry.ts')).filter((specifier) => specifier.endsWith('.css'))
    expect(entryImports).toEqual(GLOBAL_STYLESHEETS.map((rel) => `./${rel}`))
  })

  it.each(stylesheets())('%s holds no !important and no @import', (rel) => {
    const css = stripComments(readSource(rel))
    expect(css).not.toContain('!')
    expect(css).not.toMatch(/@import\b/i)
  })

  it.each(stylesheets())("%s passes the server's scope check once the preset has wrapped it", (rel) => {
    expect(cssScopeErrors(transformThemeCss(asBuilt(rel), OPTIONS), HTML_CLASS)).toEqual([])
  })

  it("passes the server's scope check as one dist/theme.css, in the entry's order", () => {
    const order = [...GLOBAL_STYLESHEETS, ...stylesheets().filter((rel) => !GLOBAL_STYLESHEETS.includes(rel))]
    const css = transformThemeCss(order.map(asBuilt).join('\n'), OPTIONS)
    expect(cssScopeErrors(css, HTML_CLASS)).toEqual([])
    const keyframes = Array.from(css.matchAll(/@(?:-webkit-)?keyframes\s+([^\s{]+)/g), (match) => match[1])
    expect(keyframes.length).toBeGreaterThan(0)
    expect(keyframes.filter((name) => !name.startsWith(`${HTML_CLASS}-`))).toEqual([])
  })

  it('names every font family it defines play-…, already in the source', () => {
    const families = Array.from(stripComments(readSource(FONTS_CSS)).matchAll(/font-family:\s*([^;}]+)/g), (m) => m[1].trim())
    expect(families.length).toBeGreaterThan(0)
    expect(families.filter((family) => !family.startsWith(`${HTML_CLASS}-`))).toEqual([])
  })
})

const SPECIFICITY_CASES: readonly (readonly [string, Specificity])[] = [
  ['.studio h1', [0, 1, 1]],
  ['.studio code:not(pre code)', [0, 1, 3]],
  ['html.play .title', [0, 2, 1]],
  [":where(html.play) body:has([data-glow='snag'])::after", [0, 1, 2]],
  [':where(html.play :focus-visible)', [0, 0, 0]],
  ['html.play:is(html.play) [aria-pressed="true"]', [0, 3, 2]],
  ['html.play:not(#play-none) *::before', [1, 1, 2]],
]

describe('the specificity helper', () => {
  it.each(SPECIFICITY_CASES)('%s is %j', (selector, expected) => {
    expect(specificity(selector)).toEqual(expected)
  })
})

describe('the html.play wrap keeps the FX-01 cascade', () => {
  it("leaves every rule of play-theme.css as written: they are all under html.play already", () => {
    expect(THEME_SELECTORS.length).toBeGreaterThan(0)
    expect(THEME_SELECTORS.filter((s) => wrapSelector(s.written, HTML_CLASS, 'html') !== s.written)).toEqual([])
  })

  it('leaves the FX-01 rules at their core specificity, above Studio element rules', () => {
    const fx01 = MODULE_SELECTORS.filter((s) => s.written.startsWith(FX01_PREFIX))
    expect(fx01.length).toBeGreaterThan(0)
    const studioTop = STUDIO_ELEMENT_RULES.map(specificity).reduce((a, b) => (compareSpecificity(a, b) >= 0 ? a : b))
    fx01.forEach((s) => {
      const built = withoutGlobal(s.written)
      expect(wrapSelector(built, HTML_CLASS, 'html')).toBe(built)
      expect(compareSpecificity(specificity(built), studioTop), `${s.file}: ${s.written}`).toBeGreaterThan(0)
    })
  })

  it('raises every other module selector by exactly (0,1,1)', () => {
    const others = MODULE_SELECTORS.filter((s) => !s.written.startsWith(FX01_PREFIX))
    expect(others.length).toBeGreaterThan(0)
    others.forEach((s) => {
      const built = withoutGlobal(s.written)
      const wrapped = wrapSelector(built, HTML_CLASS, 'html')
      expect(wrapped).toBe(`html.${HTML_CLASS} ${built}`)
      expect(specificity(wrapped), `${s.file}: ${s.written}`).toEqual(addSpecificity(specificity(built), WRAP_WEIGHT))
    })
  })
})

/** The declarations (name → value) of the rule whose selector list holds `selector`, in play-theme.css or `rel`. */
function declarationsOf(selector: string, rel = THEME_CSS): Readonly<Record<string, string>> {
  const css = stripComments(readSource(rel))
  const listed = css.indexOf(`${selector},`)
  const at = listed >= 0 ? listed : css.indexOf(`${selector} {`)
  expect(at, selector).toBeGreaterThanOrEqual(0)
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at))
  const declarations = body.split(';').filter((line) => line.includes(':'))
  return Object.fromEntries(declarations.map((line): [string, string] => {
    const colon = line.indexOf(':')
    return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()]
  }))
}

/** Every module selector of a rule setting an outline property, as built and wrapped, with its core specificity. */
function outlineModules(): { readonly label: string; readonly core: Specificity; readonly kit: Specificity }[] {
  return MODULE_SELECTORS.filter((s) => s.properties.some((name) => name.startsWith(OUTLINE))).map((s) => {
    const built = withoutGlobal(s.written)
    return { label: `${s.file}: ${s.written}`, core: specificity(built), kit: specificity(wrapSelector(built, HTML_CLASS, 'html')) }
  })
}

describe("play-theme.css's rewritten rules", () => {
  it("give the forced-colours rings the same (0,1,1) as the modules, so each outline comparison is core's", () => {
    const forced = THEME_SELECTORS.filter((s) => s.within.includes(FORCED_COLOURS_MEDIA)).map((s) => s.written)
    expect(forced.map(specificity)).toEqual(CORE_FORCED_COLOURS.map((core) => addSpecificity(specificity(core), WRAP_WEIGHT)))
    const modules = outlineModules()
    expect(modules.length).toBeGreaterThan(0)
    forced.forEach((kitSelector, index) => {
      const coreRing = specificity(CORE_FORCED_COLOURS[index])
      const kitRing = specificity(kitSelector)
      const changed = modules.filter((m) => Math.sign(compareSpecificity(coreRing, m.core)) !== Math.sign(compareSpecificity(kitRing, m.kit)))
      expect(changed.map((m) => m.label), kitSelector).toEqual([])
    })
  })

  it('stop motion by an id in place of !important, which no other Play selector has', () => {
    const stop = THEME_SELECTORS.filter((s) => s.written.includes(MOTION_STOP_ID))
    expect(stop).toHaveLength(MOTION_STOP_SELECTORS)
    stop.forEach((s) => expect(specificity(s.written)[0], s.written).toBe(1))
    const others = [...THEME_SELECTORS.filter((s) => !s.written.includes(MOTION_STOP_ID)), ...MODULE_SELECTORS]
    expect(others.filter((s) => specificity(withoutGlobal(s.written))[0] > 0).map((s) => s.written)).toEqual([])
  })

  it("stop motion under the OS setting with the stop's three declarations", () => {
    const os = THEME_SELECTORS.filter((s) => s.within.includes(REDUCED_MOTION_MEDIA)).map((s) => s.written)
    expect(os).toEqual(MOTION_TARGETS.map((target) => `html.play${MOTION_STOP_ID} ${target}`))
    os.forEach((selector) => expect(declarationsOf(selector), selector).toEqual(MOTION_STOP))
  })

  it(`stop motion when the host sets ${MOTION_MARKER}="reduce" on <html>, and on no other marker, at any width`, () => {
    const marked = THEME_SELECTORS.filter((s) => s.written.includes(MOTION_STOP_ID) && s.within.length === 0)
    const expected = MOTION_TARGETS.map((target) => `html.play${MOTION_STOP_ID}[${MOTION_MARKER}="reduce"] ${target}`)
    expect(marked.map((s) => s.written)).toEqual(expected)
    marked.forEach((s) => {
      expect(specificity(s.written)[0], s.written).toBe(1)
      expect(declarationsOf(s.written), s.written).toEqual(MOTION_STOP)
    })
  })

  it(`name builtin Play's ${OLD_MOTION_MARKER} and --pl-motion nowhere under src/, comments included (K-21)`, () => {
    expect(OLD_MOTION_VAR.test('var(--pl-motion, 1)')).toBe(true)
    expect(OLD_MOTION_VAR.test('--pl-motion-scale: 1')).toBe(false)
    const files = [...sourceScripts(), ...stylesheets()]
    expect(files.length).toBeGreaterThan(STYLESHEET_COUNT)
    const naming = files.filter((rel) => {
      const text = readSource(rel)
      return text.includes(OLD_MOTION_MARKER) || OLD_MOTION_VAR.test(text)
    })
    expect(naming).toEqual([])
  })

  it("give Play's motion factor for calc() from the host's --theme-motion alone, 1 when the host sets none", () => {
    expect(stripComments(readSource(THEME_CSS))).toMatch(MOTION_SCALE)
  })

  it('meet no inline animation or transition, which a selector cannot outrank: no Play element sets one', () => {
    const inline = /\b(?:animation|transition)[A-Za-z]*['"]?\s*:|\.style\.(?:animation|transition)|setProperty\(\s*['"](?:animation|transition)/
    const scripts = sourceScripts().filter((rel) => !rel.startsWith('vendor/'))
    expect(scripts.filter((rel) => inline.test(readSource(rel)))).toEqual([])
  })
})

describe("the heading mark on Play's own screens", () => {
  it("is the host's data-theme-heading alone", () => {
    expect(PLAY_ONLY_HEADING).toEqual({ 'data-theme-heading': true })
  })

  it(`leaves builtin Play's ${OLD_HEADING_MARK} nowhere under src/ (K-21)`, () => {
    const files = [...sourceScripts(), ...stylesheets()]
    expect(files.length).toBeGreaterThan(STYLESHEET_COUNT)
    expect(files.filter((rel) => readSource(rel).includes(OLD_HEADING_MARK))).toEqual([])
  })
})

describe("the Pause Auto control while it can't be pressed (E3g)", () => {
  it("looks disabled as the shelf's Load more does: a waiting cursor and the second text colour", () => {
    expect(declarationsOf('.pause:disabled', MASCOT_CSS)).toEqual(WAITING_DISABLED)
    expect(declarationsOf('.moreButton:disabled', SHELF_CSS)).toEqual(WAITING_DISABLED)
  })
})
