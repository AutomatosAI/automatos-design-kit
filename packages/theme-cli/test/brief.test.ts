/**
 * `automatos-theme brief` (PRD-261 B-04a) on fixtures/brand-kits/automatos.json: the shape of core's
 * `GET /api/documents/brand-kit` answer (the fields of `BrandKit` in modules/documents/brand_kit.py, the effective
 * `palette` and `palette_source` of brand_system.brand_kit_view, at the commit src/core/README.md names), holding
 * Automatos's public values only: the Studio Dark kit's three colours core's brand_palette.py names, the palette core
 * derives from them, Studio's type and the public tagline. The PRD's B-04 proof, "a brief is produced from the
 * Automatos Brand Kit": the brief has every section of skills/brand-a-theme/references/brief-template.md, in order,
 * and every proposed pair reads at 4.5:1 or more by look-kit's own contrastRatio. Every refusal writes nothing.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AA_TEXT, contrastRatio } from '@automatos/look-kit/contrast'
import { hexToTriplet } from '@automatos/look-kit/hsl'
import { afterEach, describe, expect, it } from 'vitest'
import { formatRatio } from '../src/brief-colours.ts'
import { hexColour, MEASURED_ROLES } from '../src/brief-kit.ts'
import { BRIEF_SECTIONS, suggestedName } from '../src/brief-markdown.ts'
import { BRIEF_USAGE } from '../src/brief.ts'
import { run, type CommandDeps } from '../src/cli-main.ts'

const FIXTURE = fileURLToPath(new URL('../../../fixtures/brand-kits/automatos.json', import.meta.url))
const TEMPLATE = fileURLToPath(new URL('../../../skills/brand-a-theme/references/brief-template.md', import.meta.url))
const CLI = fileURLToPath(new URL('../src/cli.ts', import.meta.url))
const OUT = 'briefs/automatos/BRIEF.md'
const REFUSED = 'automatos-theme brief: nothing was written, because:'
/** Node starting the CLI from its TypeScript source on a cold runner. */
const NODE_TIMEOUT_MS = 60_000
/** core `BrandKit`'s fields in model order, then `palette_source`, as GET answers them. */
const KIT_FIELDS = [
  'name', 'tagline', 'logo_url', 'logo_path', 'primary_color', 'secondary_color', 'text_color', 'font_family', 'company',
  'heading_font', 'font_files', 'logo_mark_url', 'logo_mark_path', 'social_handles', 'voice', 'palette', 'accent_use',
  'type_scale', 'spacing_unit_pt', 'page_margin_mm', 'logo_rules', 'logo_dark_path', 'logo_mono_path', 'currency',
  'date_style', 'country', 'updated_at', 'palette_source',
]
const PAIR_ROW = /^\| (.+?) \| `(#[0-9a-f]{6})` \| (.+?) \| `(#[0-9a-f]{6})` \| (\d+\.\d{2}):1 \|$/
const FONT_ID = 'a'.repeat(32)

type Json = Record<string, unknown>

interface Ran {
  readonly code: number
  readonly out: readonly string[]
  readonly err: readonly string[]
}

interface ParsedPair {
  readonly text: string
  readonly colour: string
  readonly ground: string
  readonly groundColour: string
  readonly printed: string
}

const folders: string[] = []
afterEach(() => folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true })))

function tempFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), 'automatos-brief-test-'))
  folders.push(folder)
  return folder
}

function fixture(): Json {
  return JSON.parse(readFileSync(FIXTURE, 'utf8')) as Json
}

/** A brand kit file in a temporary folder: the fixture with `change` applied, or `text` as it is. */
function kitFile(change: (kit: Json) => Json = (kit) => kit, text?: string): string {
  const file = join(tempFolder(), 'brand-kit.json')
  writeFileSync(file, text ?? JSON.stringify(change(fixture())))
  return file
}

const noFetch = (async () => {
  throw new Error('brief sends nothing')
}) as unknown as typeof fetch

/** `automatos-theme brief ...argv` through the command table, run in `cwd`. */
async function ranBrief(argv: readonly string[], cwd: string = tempFolder()): Promise<Ran> {
  const out: string[] = []
  const err: string[] = []
  const deps: CommandDeps = { env: {}, fetch: noFetch, cwd }
  const code = await run(['brief', ...argv], { out: (line) => out.push(line), err: (line) => err.push(line) }, deps)
  return { code, out, err }
}

/** The brief written from `kit` (default: the fixture), with the run that wrote it. */
async function brief(kit: string = FIXTURE): Promise<{ readonly text: string; readonly ran: Ran }> {
  const cwd = tempFolder()
  const ran = await ranBrief(['--brand-kit', kit, '--out', OUT], cwd)
  expect(ran.code, ran.err.join('\n')).toBe(0)
  return { text: readFileSync(join(cwd, OUT), 'utf8'), ran }
}

function headings(text: string): string[] {
  return text.split('\n').filter((line) => line.startsWith('## ')).map((line) => line.slice(3))
}

function sectionOf(text: string, heading: string): string {
  const start = text.indexOf(`\n## ${heading}\n`)
  expect(start, heading).toBeGreaterThanOrEqual(0)
  const end = text.indexOf('\n## ', start + 1)
  return text.slice(start, end < 0 ? undefined : end)
}

function proposedPairs(text: string): ParsedPair[] {
  return sectionOf(text, 'Proposed pairs').split('\n').flatMap((line) => {
    const row = PAIR_ROW.exec(line)
    return row === null ? [] : [{ text: row[1], colour: row[2], ground: row[3], groundColour: row[4], printed: row[5] }]
  })
}

describe('the brand kit fixture', () => {
  it("has the shape of core's GET /api/documents/brand-kit answer", () => {
    const kit = fixture()
    expect(Object.keys(kit)).toEqual(KIT_FIELDS)
    const palette = kit.palette as Json
    MEASURED_ROLES.forEach((role) => expect(hexColour(palette[role]), role).toBe(palette[role]))
    expect(Object.keys(kit.palette_source as Json)).toEqual(Object.keys(palette))
  })

  it('holds public values only: no contact details, handles, address, e-mail or key', () => {
    const kit = fixture()
    const text = readFileSync(FIXTURE, 'utf8')
    expect(Object.entries(kit.company as Json).filter(([field, value]) => field !== 'name' && value !== '')).toEqual([])
    expect(kit.social_handles).toEqual({})
    expect([text.includes('@'), text.includes('://'), /\b(?:sk-|ghp_|eyJ)/.test(text)]).toEqual([false, false, false])
  })
})

describe('a brief from the Automatos brand kit (the B-04 proof)', () => {
  it("has every section of brief-template.md, in the template's order", async () => {
    const { text } = await brief()
    const template = headings(readFileSync(TEMPLATE, 'utf8'))
    expect(template).toEqual([...BRIEF_SECTIONS])
    expect(headings(text)).toEqual(template)
  })

  it("proposes pairs on both tones and for every accent, each at 4.5:1 or more by look-kit's contrastRatio", async () => {
    const pairs = proposedPairs((await brief()).text)
    expect(pairs.length).toBeGreaterThan(0)
    pairs.forEach((pair) => {
      const ratio = contrastRatio(pair.colour, pair.groundColour)
      expect(ratio, `${pair.text} on ${pair.ground}`).toBeGreaterThanOrEqual(AA_TEXT)
      expect(pair.printed, `${pair.text} on ${pair.ground}`).toBe(formatRatio(ratio))
    })
    const named = new Set(pairs.map((pair) => `${pair.text} on ${pair.ground}`))
    const expected = ['body text on page', 'body text on dark ground', 'secondary text on header fills', 'accent as text on page',
      'brand colour as text on dark ground', 'label on the accent on accent fill', 'label on the brand colour on brand colour fill']
    expect(expected.filter((pair) => !named.has(pair))).toEqual([])
  })

  it("lists the grounds from the palette and the kit's darkest colour, each with its triplet and tone", async () => {
    const grounds = sectionOf((await brief()).text, 'Grounds')
    const kit = fixture()
    const palette = kit.palette as Record<string, string>
    const row = (label: string, colour: string, tone: string, from: string) => `| ${label} | \`${colour}\` | \`${hexToTriplet(colour)}\` | ${tone} | \`${from}\` |`
    expect(grounds).toContain(row('page', palette.paper, 'light', 'palette.paper (derived)'))
    expect(grounds).toContain(row('header fills', palette.surface_2, 'light', 'palette.surface_2 (derived)'))
    expect(grounds).toContain(row('dark ground', kit.secondary_color as string, 'dark', 'secondary_color'))
  })

  it("keeps the brand's own colour as a fill where it reads under AA as text, and proposes a mix of it there", async () => {
    const { text } = await brief()
    const brand = fixture().primary_color as string
    expect(contrastRatio(brand, (fixture().palette as Json).paper as string)).toBeLessThan(AA_TEXT)
    const row = sectionOf(text, 'Accents').split('\n').find((line) => line.startsWith('| brand colour | page '))
    expect(row).toMatch(/\| `#[0-9a-f]{6}` \(mixed to read\) \| `#e96235` \(the kit's\) \|/)
    const onPage = proposedPairs(text).filter((pair) => pair.text === 'brand colour as text' && pair.ground === 'page')
    expect(onPage.map((pair) => pair.colour === brand)).toEqual([false])
  })

  it('names the fonts, the logo variants, the voice and a theme name', async () => {
    const { text } = await brief()
    expect(sectionOf(text, 'Fonts')).toContain('- Body: Geist (`Geist, ui-sans-serif, system-ui, sans-serif`)')
    expect(sectionOf(text, 'Fonts')).toContain('- Headings: Newsreader')
    expect(sectionOf(text, 'Fonts')).toContain('`automatos-geist`')
    const logos = sectionOf(text, 'Logo variants')
    expect(logos).toContain('| logo | uploaded, PNG | `assets/brand/logo.png` |')
    expect(logos).toContain('| one-colour logo | not set | none |')
    expect(logos).toContain('| square mark | uploaded, PNG | `assets/brand/logo-mark.png` |')
    expect(sectionOf(text, 'Voice')).toContain('  - plain: Short words that say what a thing does.')
    expect(sectionOf(text, 'Voice')).toContain('- Never write: "revolutionary", "game-changing", "seamless"')
    expect(sectionOf(text, 'Theme')).toContain('- Suggested name: `automatos`')
    expect(sectionOf(text, 'Theme')).toContain('`"tone": "from-look"`')
  })

  it('prints the path and writes the same brief for the same file', async () => {
    const first = await brief()
    const second = await brief()
    expect(first.ran.out[0]).toMatch(/briefs[\\/]automatos[\\/]BRIEF\.md$/)
    expect(first.ran.err).toEqual([])
    expect(second.text).toBe(first.text)
  })
})

describe('what the brief takes from the file', () => {
  it('lists an uploaded font file with its path in a theme and its route, and a JPEG or linked logo as such', async () => {
    const file = kitFile((kit) => ({
      ...kit,
      font_files: [{ id: FONT_ID, family: 'Geist', weight: 400, style: 'normal', path: 'x', file_name: 'geist.woff2', bytes: 1 }],
      logo_path: 'w/brand/logo.jpg',
      logo_mark_path: '',
      logo_mark_url: 'https://brand.example.com/mark.png',
    }))
    const { text } = await brief(file)
    expect(sectionOf(text, 'Fonts')).toContain(`\`assets/fonts/geist-400-normal.woff2\`, from \`GET /api/documents/brand-kit/fonts/${FONT_ID}\``)
    expect(sectionOf(text, 'Logo variants')).toContain('| logo | uploaded, JPEG: convert it to PNG or WebP |')
    expect(sectionOf(text, 'Logo variants')).toContain('| square mark | a link: `https://brand.example.com/mark.png` |')
  })

  it("never copies the company's contact details or the social handles", async () => {
    const email = ['brand', 'example.com'].join('@')
    const file = kitFile((kit) => ({ ...kit, company: { ...(kit.company as Json), email, phone: '+00 0000' }, social_handles: { linkedin: 'brand-handle' } }))
    const { text } = await brief(file)
    expect([text.includes(email), text.includes('+00 0000'), text.includes('brand-handle')]).toEqual([false, false, false])
  })

  it("keeps the file's words to one line each, so they add no heading and no table cell", async () => {
    const link = 'https://brand.example.com/a|b.png'
    const file = kitFile((kit) => ({ ...kit, name: 'Acme\n## Injected', logo_path: '', logo_url: link, palette_source: {} }))
    const { text } = await brief(file)
    expect(headings(text)).toEqual([...BRIEF_SECTIONS])
    expect(text.split('\n')[0]).toBe('# Brief: Acme ## Injected')
    expect(sectionOf(text, 'Logo variants')).toContain('| logo | a link: `https://brand.example.com/a\\|b.png` | `assets/brand/logo.png` |')
    expect(sectionOf(text, 'Grounds')).toContain('| `palette.paper` |')
  })

  it('reads #abc as #aabbcc and suggests a theme name only where one fits', () => {
    expect([hexColour('#AbC'), hexColour('#a1b2c3'), hexColour('red'), hexColour(1)]).toEqual(['#aabbcc', '#a1b2c3', null, null])
    expect(suggestedName('Café Crème Ltd')).toBe('cafe-creme-ltd')
    expect([suggestedName('Studio'), suggestedName('9 Lives'), suggestedName('')]).toEqual([null, null, null])
    expect(suggestedName('the quick brown fox jumps over the lazy dog')).toBe('the-quick-brown-fox-jumps-over')
  })

  it('lists a pair that stays under 4.5:1 as not proposed, with a warning, and proposes only the rest', async () => {
    const file = kitFile((kit) => ({ ...kit, palette: { ...(kit.palette as Json), surface_2: '#1a1714' } }))
    const { text, ran } = await brief(file)
    expect(sectionOf(text, 'Proposed pairs')).toContain('- Not proposed: ')
    expect(ran.err).toEqual([expect.stringMatching(/^warning: \d+ pair\(s\) stayed under 4\.5:1/)])
    proposedPairs(text).forEach((pair) => expect(contrastRatio(pair.colour, pair.groundColour)).toBeGreaterThanOrEqual(AA_TEXT))
  })
})

describe('refusals and usage', () => {
  it.each([
    { label: 'no file', file: () => join(tempFolder(), 'missing.json'), reason: 'is not a file' },
    { label: 'not JSON', file: () => kitFile(undefined, '{ "palette": '), reason: 'is not valid JSON text.' },
    { label: 'not an object', file: () => kitFile(undefined, '[]'), reason: 'it is not a JSON object' },
    { label: 'no palette', file: () => kitFile(({ palette: _palette, ...kit }) => kit), reason: 'it has no palette' },
  ])('$label: exit 1, the reason, nothing written', async ({ file, reason }) => {
    const cwd = tempFolder()
    const ran = await ranBrief(['--brand-kit', file(), '--out', OUT], cwd)
    expect([ran.code, ran.err[0], ran.err[1]?.includes(reason)]).toEqual([1, REFUSED, true])
    expect(existsSync(join(cwd, OUT))).toBe(false)
  })

  it('names every colour role that is missing or not a colour', async () => {
    const file = kitFile((kit) => {
      const { accent: _accent, ...palette } = kit.palette as Json
      return { ...kit, palette: { ...palette, paper: 'red', accent_2: 3 } }
    })
    const ran = await ranBrief(['--brand-kit', file, '--out', OUT])
    expect(ran.code).toBe(1)
    expect(ran.err.slice(1).map((line) => line.split(':')[1]?.trim())).toEqual(['palette.paper is "red"', 'palette.accent is missing', 'palette.accent_2 is a number'])
  })

  it('never writes over a brief that is there', async () => {
    const cwd = tempFolder()
    mkdirSync(join(cwd, 'briefs/automatos'), { recursive: true })
    writeFileSync(join(cwd, OUT), 'my notes')
    const ran = await ranBrief(['--brand-kit', FIXTURE, '--out', OUT], cwd)
    expect([ran.code, ran.err[0], ran.err[1]?.includes('is there already')]).toEqual([1, REFUSED, true])
    expect(readFileSync(join(cwd, OUT), 'utf8')).toBe('my notes')
  })

  it.each([[[]], [['--brand-kit', 'kit.json']], [['--out', OUT]], [['extra', '--brand-kit', 'k', '--out', OUT]], [['--brand-kit', 'k', '--out', OUT, '--force']]])(
    '%j is a usage error: exit 2, the usage, nothing written',
    async (argv) => {
      const cwd = tempFolder()
      const ran = await ranBrief(argv, cwd)
      expect([ran.code, ran.err]).toEqual([2, [BRIEF_USAGE]])
      expect(existsSync(join(cwd, OUT))).toBe(false)
    },
  )
})

describe('under plain Node, as the automatos-theme executable runs', () => {
  it('writes the brief from the fixture, loading @automatos/look-kit as plain Node does', () => {
    const out = join(tempFolder(), OUT)
    const ran = spawnSync(process.execPath, [CLI, 'brief', '--brand-kit', FIXTURE, '--out', out], { encoding: 'utf8' })
    expect(ran.status, ran.stderr).toBe(0)
    expect(headings(readFileSync(out, 'utf8'))).toEqual([...BRIEF_SECTIONS])
  }, NODE_TIMEOUT_MS)
})
