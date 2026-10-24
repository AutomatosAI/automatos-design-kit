// The skin designer's model (src/phone/designer.ts and src/phone/skin-export.ts), on made-up themes: a draft starts
// from Studio's own colours (each as Automatos Go paints it), from theme.json's block (standing for the same block,
// byte for byte), or from a look turned into its tokens (in the scheme of its tone, Studio's in the other); each edit
// gives a new draft; it crosses the address keeping only what the vendored validator takes; fonts are only the files
// the validator takes; the export is exactly the block when `automatos-theme skin` would write it, and no file with
// every reason otherwise; a failing pair's fix passes as `check` measures it.
import { MOBILE_AA_TEXT, MOBILE_TOKEN_NAMES, mobileErrors } from '@automatos/theme-cli/mobile'
import { measurePair } from '@automatos/theme-cli/mobile-contrast'
import { paintLook, parseColour } from '@automatos/theme-cli/mobile-paint'
import { isStudioColour, STUDIO_COLOURS, tokenName, type StudioColours } from '@automatos/theme-cli/phone'
import { skinText, withBlock } from '@automatos/theme-cli/skin-check'
import { describe, expect, it } from 'vitest'
import { measurePhone } from '../src/phone/contrast.ts'
import {
  blockOf, decodeDraft, designedSource, draftFromBlock, draftOf, encodeDraft, fontFiles, lookDraft, mascotStates, schemeOf,
  stateFiles, studioDraft, studioScheme, withDark, withFont, withToken,
} from '../src/phone/designer.ts'
import { phoneSourceOf, type PhoneSource } from '../src/phone/skin.ts'
import { draftFixes, skinExport, skinHref, textOfHref, withFix } from '../src/phone/skin-export.ts'
import { servedTheme, skinManifest, type Json } from './phone-support.tsx'

const WHITE = '0 0% 100%'
const INK = '210 16.67% 9.41%'
const DARK_GROUND = '220 13% 9%'
const DARK_TEXT = '210 20% 96%'
const BLUE = '221.21 83.19% 53.33%'
const PAPER = { '--background': WHITE, '--foreground': INK }
const NIGHT_SCHEME = { '--background': DARK_GROUND, '--foreground': DARK_TEXT }
const FONT = 'assets/fonts/mobile/Brand.ttf'
const MONO = 'assets/fonts/mobile/Mono.otf'
const MASCOT = { states: ['hello', 'idle'] }
const ASSETS = [FONT, 'assets/mascot/hello.png', 'assets/mascot/idle.png']
const BLOCK: Json = { tokens: { light: PAPER, dark: NIGHT_SCHEME }, fonts: { sans: FONT }, mascot: 'stills' }

/** A first-paint table with a tone rule (made up): paper is light, ink dark, and bare paints no ground. */
const TABLE = {
  knobs: {
    ground: {
      paper: { '--background': WHITE, '--foreground': INK, '--card': '0 0% 98%' },
      ink: { '--background': DARK_GROUND, '--foreground': DARK_TEXT, '--card': '220 13% 14%' },
      bare: { '--foreground': INK },
    },
    accent: { blue: { '--primary': BLUE, '--primary-foreground': WHITE } },
  },
  pairs: [],
  numeric: [],
  defaults: { ground: 'paper', accent: 'blue' },
  tone: { knob: 'ground', values: { paper: 'light', ink: 'dark', bare: 'light' } },
}
const look = (id: string, ground: string) => ({ schema: 'sample-look/v1', id, name: `Look ${id}`, sub: ground, ground, accent: 'blue' })
const DAY = look('day', 'paper')
const NIGHT = look('night', 'ink')
const BARE = look('plain', 'bare')

/** A made-up theme with this block (null: none) and top-level mascot, as the phone view reads it, with its assets. */
function sourceOf(mobile: Json | null, assets: readonly string[] = ASSETS): PhoneSource {
  return phoneSourceOf(servedTheme({ manifest: skinManifest(mobile, { mascot: MASCOT }), presets: [], prepaint: null }), assets)
}

describe('where a draft starts', () => {
  it("from Studio's own colours: each token as Automatos Go paints it, a block the validator takes", () => {
    const draft = studioDraft()
    const named = MOBILE_TOKEN_NAMES.filter((token) => isStudioColour(tokenName(token)))
    const schemes = ['light', 'dark'] as const
    expect(named).toHaveLength(21)
    schemes.forEach((scheme) => {
      const values: Readonly<Record<string, string>> = scheme === 'light' ? draft.light : draft.dark ?? {}
      expect(Object.keys(values)).toEqual(named)
      named.forEach((token) => {
        const studio = STUDIO_COLOURS[scheme][tokenName(token) as keyof StudioColours]
        expect([scheme, token, parseColour(values[token])]).toEqual([scheme, token, studio])
      })
    })
    expect(mobileErrors(skinManifest(blockOf(draft)))).toEqual([])
  })

  it("from theme.json's block, standing for the same block byte for byte", () => {
    expect(blockOf(draftFromBlock(BLOCK))).toEqual(BLOCK)
    expect(skinText(blockOf(draftFromBlock(BLOCK)))).toBe(skinText(BLOCK))
    expect(blockOf(draftFromBlock({ fromLooks: true, mascot: 'none' }))).toEqual({ fromLooks: true })
    expect(draftFromBlock({ fromLooks: true }).light).toEqual(studioScheme('light'))
  })

  it("from a look turned into its tokens, in the scheme of the tone it is drawn in, Studio's own in the other", () => {
    expect(lookDraft(TABLE, NIGHT, 'from-look')).toEqual({ ...studioDraft(), dark: schemeOf(paintLook(TABLE, NIGHT)) })
    expect(lookDraft(TABLE, DAY, 'from-look')).toEqual({ ...studioDraft(), light: schemeOf(paintLook(TABLE, DAY)) })
    expect(lookDraft(TABLE, NIGHT, 'from-look')?.dark?.['--background']).toBe(DARK_GROUND)
    expect(lookDraft(TABLE, NIGHT, 'light')?.light).toEqual(schemeOf(paintLook(TABLE, NIGHT)))
    expect([lookDraft(TABLE, BARE, 'from-look'), lookDraft(null, DAY, 'user')]).toEqual([null, null])
  })
})

describe('an edit', () => {
  it('gives a new draft: a token set or left to Studio, Dark given or taken away, a font set or cleared', () => {
    const draft = draftFromBlock(BLOCK)
    const before = JSON.stringify(draft)
    const ringed = withToken(draft, 'light', '--ring', '#336699')
    expect(ringed.light['--ring']).toBe('#336699')
    expect(withToken(ringed, 'light', '--ring', null).light).toEqual(draft.light)
    expect(withToken(draft, 'light', '--ring', 'blue').light).toEqual(draft.light)
    expect(withToken(draft, 'dark', '--card', '0 0% 20%').dark).toEqual({ ...NIGHT_SCHEME, '--card': '0 0% 20%' })
    expect(withDark(draft, false).dark).toBeNull()
    expect(withDark(withDark(draft, false), true).dark).toEqual(studioScheme('dark'))
    expect(withDark(draft, true).dark).toBe(draft.dark)
    expect(withFont(draft, 'mono', MONO).fonts).toEqual({ sans: FONT, mono: MONO })
    expect(withFont(draft, 'sans', null).fonts).toEqual({})
    expect(JSON.stringify(draft)).toBe(before)
  })
})

describe("the phone view's address", () => {
  it('carries a draft there and back', () => {
    const draft = withFont(withToken(studioDraft(), 'light', '--ring', '#336699'), 'serif', FONT)
    expect(decodeDraft(encodeDraft(draft))).toEqual(draft)
    const looks = { ...draft, dark: null, source: 'fromLooks', mascot: 'clips' } as const
    expect(decodeDraft(encodeDraft(looks))).toEqual(looks)
  })

  it('keeps only what the validator takes, and reads anything but a JSON object as no draft', () => {
    const odd = {
      source: 'css', light: { '--background': 'white', '--foreground': '#000000', '--shadow': '#111111' }, dark: [],
      fonts: { sans: 7, mono: FONT, emoji: FONT }, mascot: 'gif',
    }
    expect(draftOf(odd)).toEqual({ source: 'tokens', light: { '--foreground': '#000000' }, dark: null, fonts: { mono: FONT }, mascot: 'none' })
    expect([decodeDraft(null), decodeDraft('{"source":'), decodeDraft('[1]'), decodeDraft('"text"')]).toEqual([null, null, null, null])
  })
})

describe("the theme's files", () => {
  it('offers as fonts only the files the validator takes', () => {
    const assets = ['assets/fonts/Brand.woff2', FONT, MONO, 'assets/fonts/mobile/notes.txt', 'assets/fonts/mobile/sub/Deep.ttf']
    expect(fontFiles(assets)).toEqual([FONT, MONO])
  })

  it("names each state's files a mascot mode needs, and whether the theme holds each", () => {
    const manifest = skinManifest(null, { mascot: MASCOT })
    expect(stateFiles(manifest, 'clips', ASSETS)).toEqual([
      { name: 'hello', files: [{ path: 'assets/mascot/hello.mp4', held: false }, { path: 'assets/mascot/hello.png', held: true }] },
      { name: 'idle', files: [{ path: 'assets/mascot/idle.mp4', held: false }, { path: 'assets/mascot/idle.png', held: true }] },
    ])
    expect(stateFiles(manifest, 'none', ASSETS)).toEqual([{ name: 'hello', files: [] }, { name: 'idle', files: [] }])
    expect(mascotStates(skinManifest(null))).toEqual([])
  })
})

describe('the export', () => {
  it('is exactly the block, as skin.json holds it, when automatos-theme skin would write it', () => {
    const source = sourceOf(BLOCK)
    const exported = skinExport(source, draftFromBlock(BLOCK))
    expect([exported.problems, exported.block, exported.text]).toEqual([[], BLOCK, skinText(BLOCK)])
    expect(mobileErrors(withBlock(source.manifest, JSON.parse(exported.text)))).toEqual([])
    expect(skinHref(exported.text)).toMatch(/^data:application\/json;charset=utf-8,/)
    expect([textOfHref(skinHref(exported.text)), textOfHref('https://example.com/skin.json')]).toEqual([exported.text, null])
  })

  it.each<[string, Json, readonly string[], string]>([
    ['the validator refuses it', { tokens: { light: { '--foreground': INK } } }, ASSETS, (
      'BAD_MOBILE mobile.tokens.light: "mobile.tokens.light" needs "--background".'
    )],
    ['a pair is under its minimum', { tokens: { light: { ...PAPER, '--foreground': '0 0% 60%' } } }, ASSETS, (
      'MOBILE_CONTRAST mobile: mobile.tokens.light: --foreground on --background is 2.85:1'
    )],
    ["a font is not the theme's", BLOCK, [], `MISSING_FILE ${FONT}: "mobile.fonts" names ${FONT}, which isn't in the theme.`],
    ["a mascot file is not the theme's", { ...BLOCK, mascot: 'clips' }, ASSETS, 'MISSING_FILE assets/mascot/hello.mp4'],
  ])('gives no file, and the reason, when %s', (_name, block, assets, reason) => {
    const exported = skinExport(sourceOf(null, assets), draftFromBlock(block))
    expect(exported.problems.some((problem) => problem.startsWith(reason)), exported.problems.join('\n')).toBe(true)
  })
})

describe("a failing pair's fix", () => {
  it("is the nearest passing value of its first token, which then passes as check measures it", () => {
    const source = sourceOf(null)
    const draft = studioDraft()
    const fixes = draftFixes(draft, measurePhone(designedSource(source, draft)))
    const muted = fixes.find((fix) => fix.scheme === 'light' && fix.token === '--muted-foreground')
    if (muted === undefined) throw new Error("Studio Light's muted text is under 4.5:1 on --muted")
    expect(muted.background).toBe('--muted')
    const fixed = withFix(draft, muted)
    const pair = measurePair(fixed.light, ['--muted-foreground', '--muted', 'text'])
    expect([pair.status, (pair.ratio ?? 0) >= MOBILE_AA_TEXT, fixed.light['--muted-foreground']]).toEqual(['pass', true, muted.value])
    const after = draftFixes(fixed, measurePhone(designedSource(source, fixed)))
    expect(after.some((fix) => fix.scheme === 'light' && fix.token === '--muted-foreground')).toBe(false)
  })
})
