/**
 * `automatos-theme previews` (PRD-261 B-02g) on a copy of core's hello theme (test/fixtures/core/hello/, presets
 * `default` and `night`) in a temporary folder, with shots laid out as `automatos-theme shots` writes them
 * (`<browser>/<preset>/<width>/<view>.png`): the picks become assets/previews/<preset>.png and <preset>-<screen>.png,
 * theme.json lists them in the order given (the first is the listing's cover), and `check` then reports previews pass.
 * A shot over 512 KB, a name no preset claims (listings.py's rule, as check/previews.ts ports it) and every other
 * refusal write nothing.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { run, type CommandDeps } from '../src/cli-main.ts'
import { DEFAULT_BROWSER, DEFAULT_WIDTH, PREVIEWS_USAGE, previewsCommand } from '../src/previews.ts'
import { HELLO_DIR, helloFolder, ranCheck, removeTempFolders, tempFolder } from './check-support.ts'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
/** core's reader's cap for a preview (files.ts, package.py): 512 KB. */
const PREVIEW_CAP = 512 * 1024
const MANIFEST = 'theme.json'
const PREVIEW_DIR = 'assets/previews'
/** hello's first view in the harness's order (router.ts viewsOf, viewSlug): frame@1's own. */
const FRAME_VIEW = 'slot-frame-1.png'
/** hello's one route, /x/hello, as its shot is named. */
const ROUTE_VIEW = 'route-hello.png'

afterEach(removeTempFolders)

interface Ran {
  readonly code: number
  readonly out: readonly string[]
  readonly err: readonly string[]
}

/** PNG bytes: the signature, then `marker` up to `size` bytes, so no two shots match by accident. */
function png(marker: number, size = PNG_SIGNATURE.length + 1): Uint8Array {
  return Uint8Array.from({ length: size }, (_, index) => (index < PNG_SIGNATURE.length ? PNG_SIGNATURE[index] : marker))
}

/** A shot's path in the shots folder: Chromium at 1440 px, frame@1's view, unless given. */
function shotOf(preset: string, view = FRAME_VIEW, browser = DEFAULT_BROWSER, width = DEFAULT_WIDTH): string {
  return `${browser}/${preset}/${width}/${view}`
}

/** A shots folder holding `shots` (a path in it, its bytes). */
function shotsFolder(shots: Readonly<Record<string, Uint8Array | string>>): string {
  const folder = join(tempFolder(), 'shots')
  mkdirSync(folder, { recursive: true })
  Object.entries(shots).forEach(([path, data]) => {
    mkdirSync(dirname(join(folder, path)), { recursive: true })
    writeFileSync(join(folder, path), data)
  })
  return folder
}

const noFetch = (async () => {
  throw new Error('previews sends nothing')
}) as unknown as typeof fetch

async function ranPreviews(argv: readonly string[]): Promise<Ran> {
  const out: string[] = []
  const err: string[] = []
  const deps: CommandDeps = { env: {}, fetch: noFetch, cwd: process.cwd() }
  const code = await previewsCommand(['previews', ...argv], { out: (line) => out.push(line), err: (line) => err.push(line) }, deps)
  return { code, out, err }
}

function listed(theme: string): unknown {
  return (JSON.parse(readFileSync(join(theme, MANIFEST), 'utf8')) as { previews?: unknown }).previews
}

function previewPath(name: string): string {
  return `${PREVIEW_DIR}/${name}.png`
}

/** True when the theme folder is as it was: theme.json's text unchanged and no assets/previews/. */
function untouched(theme: string, manifestText: string): boolean {
  return readFileSync(join(theme, MANIFEST), 'utf8') === manifestText && !existsSync(join(theme, PREVIEW_DIR))
}

describe('automatos-theme previews', () => {
  it('copies each pick to assets/previews/<name>.png, lists them in the order given, and check reports previews pass', async () => {
    const theme = helloFolder()
    const routeShot = shotOf('default', ROUTE_VIEW, 'webkit', 1024)
    const shots = shotsFolder({ [shotOf('night')]: png(1), [shotOf('default')]: png(2), [routeShot]: png(3) })
    const picks = ['--pick', `night=${shotOf('night')}`, '--pick', `default=${shotOf('default')}`, '--pick', `default-hello=${routeShot}`]
    const ran = await ranPreviews([theme, '--from', shots, ...picks])
    const order = [previewPath('night'), previewPath('default'), previewPath('default-hello')]
    expect([ran.code, ran.err]).toEqual([0, []])
    expect(ran.out).toEqual([
      `${order[0]} from ${shotOf('night')}`,
      `${order[1]} from ${shotOf('default')}`,
      `${order[2]} from ${routeShot}`,
      `${MANIFEST} lists 3 preview(s), in the order above; the listing's cover is the first, ${order[0]}.`,
    ])
    expect(listed(theme)).toEqual(order)
    expect(readdirSync(join(theme, PREVIEW_DIR)).sort()).toEqual(['default-hello.png', 'default.png', 'night.png'])
    expect(readFileSync(join(theme, order[2])).equals(png(3))).toBe(true)
    const checked = await ranCheck(['check', theme, '--json'])
    expect(checked.code).toBe(0)
    expect((JSON.parse(checked.out.join('\n')) as { checks: { previews: unknown } }).checks.previews).toMatchObject({
      level: 'pass',
      status: 'checked',
      cover: order[0],
      otherPreviews: [],
      presets: [
        { id: 'default', default: true, previews: [{ screen: null, path: order[1] }, { screen: 'hello', path: order[2] }] },
        { id: 'night', default: false, previews: [{ screen: null, path: order[0] }] },
      ],
    })
  })

  it("with no --pick, gives each preset its first view on Chromium at 1440 px, the default look first: it is the cover", async () => {
    const theme = helloFolder({ manifest: { look: 'night' } })
    const shots = shotsFolder({ [shotOf('default')]: png(1), [shotOf('night')]: png(2) })
    const ran = await ranPreviews([theme, '--from', shots])
    expect([ran.code, ran.err]).toEqual([0, []])
    expect(listed(theme)).toEqual([previewPath('night'), previewPath('default')])
    expect(readFileSync(join(theme, previewPath('night'))).equals(png(2))).toBe(true)
  })

  it('refuses a shot over 512 KB, naming it and the cap, and writes nothing; a shot of exactly 512 KB is taken', async () => {
    const theme = helloFolder()
    const before = readFileSync(join(theme, MANIFEST), 'utf8')
    const shots = shotsFolder({ [shotOf('default')]: png(1, PREVIEW_CAP + 1), [shotOf('night')]: png(2, PREVIEW_CAP) })
    const ran = await ranPreviews([theme, '--from', shots])
    expect(ran.code).toBe(1)
    expect(ran.err).toEqual([
      `automatos-theme previews: nothing was written to ${theme}, because:`,
      `  ${shotOf('default')} is ${PREVIEW_CAP + 1} bytes: a preview must be 512 KB or smaller, as core's reader holds it.`,
    ])
    expect(ran.out).toEqual([])
    expect(untouched(theme, before)).toBe(true)
    const atCap = await ranPreviews([theme, '--from', shots, '--pick', `night=${shotOf('night')}`])
    expect([atCap.code, listed(theme)]).toEqual([0, [previewPath('night')]])
  })

  it("refuses a name no preset claims (listings.py's rule, as check/previews.ts ports it), naming the presets, and writes nothing", async () => {
    const theme = helloFolder()
    const before = readFileSync(join(theme, MANIFEST), 'utf8')
    const shots = shotsFolder({ [shotOf('night')]: png(1) })
    const picks = ['sunset', 'nightly', 'night', 'night-sky'].flatMap((name) => ['--pick', `${name}=${shotOf('night')}`])
    const ran = await ranPreviews([theme, '--from', shots, ...picks])
    expect(ran.code).toBe(1)
    expect(ran.err.slice(1)).toEqual(['sunset', 'nightly'].map((name) => (
      `  "${name}" belongs to no preset: a preview is named <preset> or <preset>-<screen>, and its presets are default, night.`
    )))
    expect(untouched(theme, before)).toBe(true)
  })

  /** Each refusal: what it is, the picks, and its one reason (given the shots folder). */
  const refusals: Array<[string, string[], (shots: string) => string]> = [
    ['a shot that is not there', [`night=${shotOf('night', 'page-chat.png')}`], (shots) => `${shotOf('night', 'page-chat.png')}: there is no such shot in ${shots}.`],
    ['a shot outside the shots folder', ['night=../outside.png'], (shots) => `../outside.png is not inside the shots folder ${shots}.`],
    ['a shot that is not a PNG', [`night=${shotOf('night', 'text.png')}`], () => `${shotOf('night', 'text.png')}: its bytes are not a PNG image.`],
    ['a name that is no preview file name', [`night/chat=${shotOf('night')}`], () => (
      '"night/chat" can\'t name a preview: core takes assets/previews/<name>.png, the name letters, digits, ".", "_" and "-", '
      + 'starting with a letter or digit, at most 128 characters.'
    )],
    ['one name picked twice', [`night=${shotOf('night')}`, `night=${shotOf('default')}`], () => '"night" is picked twice: each preview is one shot.'],
    ['more than 24 previews', Array.from({ length: 25 }, (_, index) => `night-s${index}=${shotOf('night')}`), () => (
      'theme.json: "previews" must list up to 24 different assets/previews/*.png files.'
    )],
  ]

  it.each(refusals)('refuses %s with one reason, and writes nothing', async (_label, picks, reason) => {
    const theme = helloFolder()
    const before = readFileSync(join(theme, MANIFEST), 'utf8')
    const shots = shotsFolder({ [shotOf('night')]: png(1), [shotOf('default')]: png(2), [shotOf('night', 'text.png')]: 'not an image\n' })
    const ran = await ranPreviews([theme, '--from', shots, ...picks.flatMap((pick) => ['--pick', pick])])
    expect([ran.code, ran.err.slice(1), ran.out]).toEqual([1, [`  ${reason(shots)}`], []])
    expect(untouched(theme, before)).toBe(true)
  })

  it('refuses a folder with no theme.json, and a --from that is no folder', async () => {
    const empty = tempFolder()
    const noTheme = await ranPreviews([empty, '--from', shotsFolder({})])
    expect([noTheme.code, noTheme.err.slice(1)]).toEqual([1, [`  ${empty} has no theme.json: previews takes a theme folder.`]])
    const missing = join(empty, 'missing')
    const noShots = await ranPreviews([helloFolder(), '--from', missing])
    expect([noShots.code, noShots.err.slice(1)]).toEqual([1, [`  ${missing} is not a folder: --from takes the folder automatos-theme shots wrote.`]])
  })

  it("keeps theme.json's own layout: previews is added after the last field, then replaced where it stands", async () => {
    const theme = join(tempFolder(), 'hello')
    cpSync(HELLO_DIR, theme, { recursive: true })
    const before = readFileSync(join(theme, MANIFEST), 'utf8')
    const shots = shotsFolder({ [shotOf('default')]: png(1), [shotOf('night')]: png(2) })
    expect((await ranPreviews([theme, '--from', shots, '--pick', `night=${shotOf('night')}`])).code).toBe(0)
    const added = before.replace(/\n}\n$/, `,\n  "previews": [\n    "${previewPath('night')}"\n  ]\n}\n`)
    expect(added).not.toBe(before)
    expect(readFileSync(join(theme, MANIFEST), 'utf8')).toBe(added)
    expect((await ranPreviews([theme, '--from', shots])).code).toBe(0)
    const replaced = added.replace(`    "${previewPath('night')}"\n`, `    "${previewPath('default')}",\n    "${previewPath('night')}"\n`)
    expect(readFileSync(join(theme, MANIFEST), 'utf8')).toBe(replaced)
  })

  it('leaves a preview theme.json no longer lists where it is, with a warning, since pack still packs it', async () => {
    const theme = helloFolder()
    const shots = shotsFolder({ [shotOf('default')]: png(1), [shotOf('night')]: png(2) })
    expect((await ranPreviews([theme, '--from', shots])).code).toBe(0)
    const ran = await ranPreviews([theme, '--from', shots, '--pick', `night=${shotOf('night')}`])
    expect([ran.code, listed(theme)]).toEqual([0, [previewPath('night')]])
    expect(existsSync(join(theme, previewPath('default')))).toBe(true)
    expect(ran.err).toEqual([
      `warning: ${previewPath('default')} is in ${theme} but theme.json no longer lists it; pack still packs it, so delete it or pick it again.`,
    ])
  })
})

describe('usage', () => {
  it.each([
    [[]],
    [['theme']],
    [['theme', '--from']],
    [['theme', '--from', 'shots', '--pick', 'night']],
    [['theme', '--from', 'shots', '--pick', '=a.png']],
    [['theme', '--from', 'shots', '--pick', 'night=']],
    [['a', 'b', '--from', 'shots']],
    [['theme', '--from', 'shots', '--fast']],
  ])('previews %j: the usage, exit 2', async (argv) => {
    const ran = await ranPreviews(argv)
    expect([ran.code, ran.err, ran.out]).toEqual([2, [PREVIEWS_USAGE], []])
  })
})

describe('through the command table', () => {
  it('runs previews from its module and sends nothing', async () => {
    const theme = helloFolder()
    const shots = shotsFolder({ [shotOf('default')]: png(1), [shotOf('night')]: png(2) })
    const sent: unknown[] = []
    const deps: CommandDeps = {
      env: {},
      fetch: (async (...args: unknown[]) => {
        sent.push(args)
        throw new Error('previews sends nothing')
      }) as typeof fetch,
      cwd: process.cwd(),
    }
    const code = await run(['previews', theme, '--from', shots], { out: () => undefined, err: () => undefined }, deps)
    expect([code, sent, listed(theme)]).toEqual([0, [], [previewPath('default'), previewPath('night')]])
  })
})
