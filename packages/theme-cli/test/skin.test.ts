/**
 * `automatos-theme skin <theme folder> --from <skin.json>` on made-up themes in temporary folders: the block is
 * written as theme.json's `mobile` field, the file's own layout kept (added after the last field, or in place of the
 * old block), and each refusal prints its reasons, exits 1 and leaves theme.json exactly as it was: a block the
 * vendored validator refuses, a theme whose engines admit a host below 1.1.0, a pair under its contrast minimum (with
 * the nearest passing value), a colour set from the looks with no ground, a font or mascot file the theme doesn't
 * have, a released theme of the kit (by folder, through a link too) or of Automatos's own publisher, an unreadable
 * skin file. A command it can't parse is a usage error.
 */
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { MOBILE_MASCOT_FILES } from '../src/check-package.ts'
import { run, type CommandDeps } from '../src/cli-main.ts'
import { KIT_ROOT } from '../src/new/index.ts'
import { RELEASED_FOLDERS, runSkin, SKIN_USAGE } from '../src/skin.ts'
import { skinMascotFiles } from '../src/skin-check.ts'
import { withField } from '../src/theme-json.ts'
import { removeTempFolders, tempFolder, type Ran } from './check-support.ts'

type Json = Readonly<Record<string, unknown>>

const MANIFEST = 'theme.json'
const FONT = 'assets/fonts/mobile/Sample-Regular.ttf'
/** A theme.json laid out by hand, as an author writes one: short objects and lists on one line. */
const MANIFEST_TEXT = [
  '{',
  '  "schema": "automatos-theme/v1",',
  '  "id": "example/harbour",',
  '  "name": "Harbour",',
  '  "version": "0.1.0",',
  '  "engines": { "automatos": "^1.1.0", "sdk": "^1.1.0" },',
  '  "base": "studio",',
  '  "htmlClass": "harbour",',
  '  "minWidth": 1024,',
  '  "tone": "user",',
  '  "slots": ["frame@1", "lookEditor@1", "styleSheet@1"],',
  '  "mascot": { "states": ["hello", "idle"] }',
  '}',
  '',
].join('\n')
const FILES: Readonly<Record<string, string>> = {
  [FONT]: 'font', 'assets/mascot/hello.png': 'png', 'assets/mascot/idle.png': 'png', 'assets/mascot/hello.mp4': 'mp4',
}
const PAPER = { '--background': '0 0% 100%', '--foreground': '0 0% 9%' }
const NIGHT = { '--background': '0 0% 9%', '--foreground': '0 0% 96%' }
const BLOCK: Json = { tokens: { light: PAPER, dark: NIGHT }, fonts: { sans: FONT }, mascot: 'stills' }

const WHITE = '0 0% 100%'
const BLUE = '221.21 83.19% 53.33%'
/** A first-paint table whose two grounds each paint a ground and its text (made up); `bare` paints no ground. */
const TABLE = {
  knobs: {
    ground: {
      paper: { '--background': WHITE, '--foreground': '210 16.67% 9.41%' },
      ink: { '--background': '220 13% 9%', '--foreground': '210 20% 96%' },
      bare: { '--foreground': '210 16.67% 9.41%' },
    },
    accent: { blue: { '--primary': BLUE, '--primary-foreground': WHITE } },
  },
  pairs: [],
  numeric: [],
  defaults: { ground: 'paper', accent: 'blue' },
}
const lookFile = (id: string, ground: string): string => JSON.stringify({ schema: 'sample-look/v1', id, name: id, ground, accent: 'blue' })

afterEach(removeTempFolders)

/** A theme folder holding theme.json as `text` and `files` (a path in it, its text), in a temporary folder or `at`. */
function themeFolder(text: string = MANIFEST_TEXT, files: Readonly<Record<string, string>> = FILES, at?: string): string {
  const theme = at ?? join(tempFolder(), 'harbour')
  Object.entries({ [MANIFEST]: text, ...files }).forEach(([path, data]) => {
    mkdirSync(dirname(join(theme, path)), { recursive: true })
    writeFileSync(join(theme, path), data)
  })
  return theme
}

/** skin.json holding `block` as JSON, or the text given. */
function skinFile(block: unknown): string {
  const path = join(tempFolder(), 'skin.json')
  writeFileSync(path, typeof block === 'string' ? block : JSON.stringify(block))
  return path
}

function ranSkin(argv: readonly string[], kitRoot?: string): Ran {
  const out: string[] = []
  const err: string[] = []
  const code = runSkin(['skin', ...argv], { out: (line) => out.push(line), err: (line) => err.push(line) }, process.cwd(), kitRoot)
  return { code, out, err }
}

const manifestOf = (theme: string): string => readFileSync(join(theme, MANIFEST), 'utf8')

/** A refusal: exit 1, theme.json as it was, the opening line, and every one of `reasons` among the lines under it. */
function expectRefused(theme: string, ran: Ran, reasons: readonly string[]): void {
  expect([ran.code, ran.out, manifestOf(theme)]).toEqual([1, [], MANIFEST_TEXT])
  expect(ran.err[0]).toBe(`automatos-theme skin: nothing was written to ${theme}, because:`)
  reasons.forEach((reason) => expect(ran.err.slice(1).some((line) => line.includes(reason)), reason).toBe(true))
}

describe('automatos-theme skin writes the block', () => {
  it("adds it after the last field, every other line of theme.json as it was, and says what check's measure found", () => {
    const theme = themeFolder()
    const from = skinFile(BLOCK)
    const ran = ranSkin([theme, '--from', from])
    expect([ran.code, ran.err]).toEqual([0, []])
    expect(ran.out).toEqual([`${join(theme, MANIFEST)}: its mobile block is now ${from}.`, expect.stringMatching(/^contrast: Every measured colour pair/)])
    const text = manifestOf(theme)
    const close = MANIFEST_TEXT.lastIndexOf('}')
    expect(text.startsWith(`${MANIFEST_TEXT.slice(0, close).trimEnd()},\n  "mobile": {\n    "tokens": {\n      "light": {\n`)).toBe(true)
    expect(text.endsWith('\n    "mascot": "stills"\n  }\n}\n')).toBe(true)
    expect(JSON.parse(text)).toEqual({ ...(JSON.parse(MANIFEST_TEXT) as Json), mobile: BLOCK })
  })

  it('replaces the old block where it stands, the field after it kept as it was', () => {
    const before = MANIFEST_TEXT.replace('  "mascot":', '  "mobile": { "fromLooks": true, "mascot": "none" },\n  "mascot":')
    const theme = themeFolder(before)
    expect(ranSkin([theme, '--from', skinFile(BLOCK)]).code).toBe(0)
    const text = manifestOf(theme)
    const head = before.slice(0, before.indexOf('  "mobile"'))
    expect([text.startsWith(`${head}  "mobile": {\n`), text.endsWith(',\n  "mascot": { "states": ["hello", "idle"] }\n}\n')]).toEqual([true, true])
    expect(JSON.parse(text)).toEqual({ ...(JSON.parse(before) as Json), mobile: BLOCK })
  })

  it('writes a block that paints from the looks when every preset and the defaults pass', () => {
    const theme = themeFolder(MANIFEST_TEXT, {
      'boot/prepaint.json': JSON.stringify(TABLE), 'looks/presets/day.look.json': lookFile('day', 'paper'),
      'looks/presets/night.look.json': lookFile('night', 'ink'),
    })
    const ran = ranSkin([theme, '--from', skinFile({ fromLooks: true })])
    expect([ran.code, ran.err]).toEqual([0, []])
    expect((JSON.parse(manifestOf(theme)) as Json).mobile).toEqual({ fromLooks: true })
  })

  it('runs through the command table', async () => {
    const theme = themeFolder()
    const deps: CommandDeps = { env: {}, fetch: globalThis.fetch, cwd: process.cwd() }
    const code = await run(['skin', theme, '--from', skinFile(BLOCK)], { out: () => undefined, err: () => undefined }, deps)
    expect([code, (JSON.parse(manifestOf(theme)) as Json).mobile]).toEqual([0, BLOCK])
  })
})

describe('automatos-theme skin refuses, and writes nothing', () => {
  it('a block the vendored validator refuses, with every reason', () => {
    const theme = themeFolder()
    const ran = ranSkin([theme, '--from', skinFile({ tokens: { light: { '--background': 'white' } }, extra: 1 })])
    expectRefused(theme, ran, [
      'UNKNOWN_FIELD mobile.extra', 'BAD_MOBILE mobile.tokens.light.--background', '"mobile.tokens.light" needs "--foreground"',
    ])
  })

  it('a theme whose engines admit a host below 1.1.0', () => {
    const text = MANIFEST_TEXT.replace('"automatos": "^1.1.0"', '"automatos": "^1.0.0"')
    const theme = themeFolder(text)
    const ran = ranSkin([theme, '--from', skinFile(BLOCK)])
    expect([ran.code, manifestOf(theme)]).toEqual([1, text])
    expect(ran.err).toContainEqual(expect.stringContaining('BAD_MOBILE engines.automatos'))
  })

  it('a pair under its minimum, naming the nearest passing value of its first token', () => {
    const theme = themeFolder()
    const grey = { tokens: { light: { '--background': WHITE, '--foreground': '0 0% 60%' } } }
    const ran = ranSkin([theme, '--from', skinFile(grey)])
    expectRefused(theme, ran, ['MOBILE_CONTRAST mobile: mobile.tokens.light: --foreground on --background is 2.85:1'])
    expect(ran.err.at(-1)).toMatch(/^ {2}nearest passing: mobile\.tokens\.light\.--foreground "0 0% \d+(\.\d+)?%" \(on --background\)$/)
  })

  it('a block from the looks when a preset paints no ground', () => {
    const theme = themeFolder(MANIFEST_TEXT, { 'boot/prepaint.json': JSON.stringify(TABLE), 'looks/presets/plain.look.json': lookFile('plain', 'bare') })
    expectRefused(theme, ranSkin([theme, '--from', skinFile({ fromLooks: true })]), ['MOBILE_CONTRAST mobile: Preset "plain": gives no --background'])
  })

  it("a font or a mascot file the theme doesn't have", () => {
    const theme = themeFolder()
    const block = { ...BLOCK, fonts: { sans: 'assets/fonts/mobile/Missing.ttf' }, mascot: 'clips' }
    expectRefused(theme, ranSkin([theme, '--from', skinFile(block)]), [
      'MISSING_FILE assets/fonts/mobile/Missing.ttf', 'MISSING_FILE assets/mascot/idle.mp4',
    ])
  })

  it("a theme inside the kit's released themes, by its folder or through a link to it", () => {
    const kit = tempFolder()
    expect(RELEASED_FOLDERS).toEqual(['themes/play', 'themes/hud'])
    const theme = themeFolder(MANIFEST_TEXT, FILES, join(kit, 'themes/hud'))
    expectRefused(theme, ranSkin([theme, '--from', skinFile(BLOCK)], kit), ["inside the kit's themes/hud/, a released theme"])
    const link = join(tempFolder(), 'linked')
    symlinkSync(theme, link)
    expectRefused(link, ranSkin([link, '--from', skinFile(BLOCK)], kit), ["inside the kit's themes/hud/"])
  })

  it("the kit's own Play, whose theme.json stays byte for byte", () => {
    const play = join(KIT_ROOT, 'themes/play')
    const before = readFileSync(join(play, MANIFEST))
    const ran = ranSkin([play, '--from', join(tempFolder(), 'no-skin.json')])
    expect([ran.code, readFileSync(join(play, MANIFEST)).equals(before)]).toEqual([1, true])
    expect(ran.err).toContainEqual(expect.stringContaining("inside the kit's themes/play/, a released theme"))
    expect(ran.err).toContainEqual(expect.stringContaining('"automatos/play" is one of Automatos\'s own themes'))
  })

  it("a theme of Automatos's own publisher", () => {
    const text = MANIFEST_TEXT.replace('"example/harbour"', '"automatos/harbour"')
    const theme = themeFolder(text)
    const ran = ranSkin([theme, '--from', skinFile(BLOCK)])
    expect([ran.code, manifestOf(theme)]).toEqual([1, text])
    expect(ran.err).toContainEqual(expect.stringContaining('"automatos/harbour" is one of Automatos\'s own themes'))
  })

  it('a skin file that is not JSON, and a folder with no theme.json', () => {
    const theme = themeFolder()
    expectRefused(theme, ranSkin([theme, '--from', skinFile('{ "tokens": ')]), ['is not valid JSON text.'])
    const empty = tempFolder()
    const ran = ranSkin([empty, '--from', skinFile(BLOCK)])
    expect([ran.code, ran.err[1]]).toEqual([1, `  ${empty} has no theme.json: skin takes a theme folder.`])
  })
})

describe('the command line', () => {
  it.each([[[]], [['themes/harbour']], [['themes/harbour', '--from']], [['a', 'b', '--from', 'skin.json']], [['a', '--from', 'skin.json', '--force-contrast']]])(
    'skin %j is a usage error: exit 2 and the usage line',
    (argv) => {
      expect(ranSkin(argv)).toEqual({ code: 2, out: [], err: [SKIN_USAGE] })
    },
  )

  it("names each mascot state's files as pack's MOBILE_MASCOT_FILES does", () => {
    const manifest = { mascot: { states: ['hello'] } }
    Object.entries(MOBILE_MASCOT_FILES).forEach(([mode, suffixes]) => {
      expect(skinMascotFiles(manifest, { mascot: mode })).toEqual(suffixes.map((suffix) => `assets/mascot/hello.${suffix}`))
    })
  })

  it('writes theme.json whole, with two-space indents, when the field sits on a line with another', () => {
    const text = '{"id": "example/harbour", "mobile": {"fromLooks": true}}\n'
    const document = JSON.parse(text) as Json
    expect(withField(text, document, 'mobile', BLOCK)).toBe(`${JSON.stringify({ ...document, mobile: BLOCK }, null, 2)}\n`)
  })
})
