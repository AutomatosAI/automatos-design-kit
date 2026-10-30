/**
 * `automatos-theme previews --phone` on a copy of core's hello theme (presets `default` and `night`) in a temporary
 * folder, with a folder of made-up phone screenshots: the picks become assets/previews/phone/<name>.png or .jpg (the
 * extension the file's bytes give), theme.json's `phonePreviews` lists them in the order given (the first is the
 * listing's phone cover), and `check` then puts each under its preset. With no --pick every picture in the folder is
 * a pick, the default look's first. Every refusal (a file that is no PNG or JPEG, over 512 KB, outside the folder, a
 * name no preset claims, picked twice, more than 24) writes nothing; a landscape screenshot is written with a warning.
 * The web's previews and the phone's live side by side: a run of one leaves the other's list and folder alone.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { encodePng } from '@automatos/theme-harness/png'
import type { CommandDeps } from '../src/cli-main.ts'
import { PREVIEWS_USAGE, previewsCommand } from '../src/previews.ts'
import { helloFolder, ranCheck, removeTempFolders, tempFolder, type Ran } from './check-support.ts'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff, 0xe0]
const PHONE = 'assets/previews/phone'
const WEB = 'assets/previews'
const MANIFEST = 'theme.json'
/** core's reader's cap for a screenshot (files.ts, package.py): 512 KB. */
const IMAGE_CAP = 512 * 1024

afterEach(removeTempFolders)

/** Bytes: the signature, then `marker` up to `size` bytes, so no two files match by accident. */
function bytes(signature: readonly number[], marker: number, size = signature.length + 1): Uint8Array {
  return Uint8Array.from({ length: size }, (_, index) => (index < signature.length ? signature[index] : marker))
}

const png = (marker: number, size?: number): Uint8Array => bytes(PNG_SIGNATURE, marker, size)
const jpeg = (marker: number, size?: number): Uint8Array => bytes(JPEG_SIGNATURE, marker, size)

/** A real PNG `width` by `height`, whose header gives its size. */
function sizedPng(width: number, height: number): Uint8Array {
  return new Uint8Array(encodePng({ width, height, pixels: Buffer.alloc(width * height * 4) }))
}

/** A folder holding `files` (a path in it, its bytes). */
function screenshots(files: Readonly<Record<string, Uint8Array | string>>): string {
  const folder = join(tempFolder(), 'phone-shots')
  mkdirSync(folder, { recursive: true })
  Object.entries(files).forEach(([path, data]) => {
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

function manifestOf(theme: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(theme, MANIFEST), 'utf8')) as Record<string, unknown>
}

const phonePath = (name: string): string => `${PHONE}/${name}`
const picks = (...given: string[]): string[] => given.flatMap((pick) => ['--pick', pick])

describe('automatos-theme previews --phone', () => {
  it('copies each pick to assets/previews/phone/ under the extension its bytes give, and lists them in order', async () => {
    const theme = helloFolder()
    const folder = screenshots({ 'IMG_0001.PNG': png(1), 'chat.jpeg': jpeg(2), 'agents.png': jpeg(3) })
    const ran = await ranPreviews([theme, '--phone', folder, ...picks('night-chat=chat.jpeg', 'default=IMG_0001.PNG', 'default-agents=agents.png')])
    const order = [phonePath('night-chat.jpg'), phonePath('default.png'), phonePath('default-agents.jpg')]
    expect([ran.code, ran.err]).toEqual([0, []])
    expect(ran.out).toEqual([
      `${order[0]} from chat.jpeg`,
      `${order[1]} from IMG_0001.PNG`,
      `${order[2]} from agents.png`,
      `${MANIFEST} lists 3 phone screenshot(s), in the order above; the listing's phone cover is the first, ${order[0]}.`,
    ])
    expect(manifestOf(theme).phonePreviews).toEqual(order)
    expect(manifestOf(theme).previews).toBeUndefined()
    expect(readFileSync(join(theme, order[2])).equals(jpeg(3))).toBe(true)
    const checked = await ranCheck(['check', theme, '--json'])
    expect(checked.code).toBe(0)
    expect((JSON.parse(checked.out.join('\n')) as { checks: { previews: unknown } }).checks.previews).toMatchObject({
      level: 'pass',
      phoneCover: order[0],
      otherPhonePreviews: [],
      presets: [
        { id: 'default', phonePreviews: [{ screen: null, path: order[1] }, { screen: 'agents', path: order[2] }] },
        { id: 'night', phonePreviews: [{ screen: 'chat', path: order[0] }] },
      ],
    })
  })

  it('with no --pick, takes every picture right in the folder by its name, the default look first, then by name', async () => {
    const theme = helloFolder({ manifest: { look: 'night' } })
    const folder = screenshots({
      'default.PNG': png(1), 'default-chat.jpg': jpeg(2), 'night.jpeg': jpeg(3), 'notes.txt': 'not a picture\n',
      '.hidden.png': png(4), 'older/night-chat.png': png(5),
    })
    const ran = await ranPreviews([theme, '--phone', folder])
    expect([ran.code, ran.err]).toEqual([0, []])
    expect(manifestOf(theme).phonePreviews).toEqual([phonePath('night.jpg'), phonePath('default.png'), phonePath('default-chat.jpg')])
    expect(readdirSync(join(theme, PHONE)).sort()).toEqual(['default-chat.jpg', 'default.png', 'night.jpg'])
  })

  it('writes a landscape screenshot with a warning, since the storefront draws a portrait phone', async () => {
    const theme = helloFolder()
    const folder = screenshots({ 'wide.png': sizedPng(20, 10), 'tall.png': sizedPng(9, 19) })
    const ran = await ranPreviews([theme, '--phone', folder, ...picks('default=tall.png', 'night=wide.png')])
    expect(ran.code).toBe(0)
    expect(ran.err).toEqual([
      `warning: ${phonePath('night.png')} is 20 by 10 pixels, not portrait: the Marketplace draws a phone screenshot in a `
      + 'portrait phone frame, so take it with the phone held upright.',
    ])
    expect(manifestOf(theme).phonePreviews).toEqual([phonePath('default.png'), phonePath('night.png')])
  })

  it('takes 24 phone screenshots', async () => {
    const theme = helloFolder()
    const folder = screenshots({ 'shot.jpg': jpeg(1) })
    const ran = await ranPreviews([theme, '--phone', folder, ...picks(...Array.from({ length: 24 }, (_, index) => `night-s${index}=shot.jpg`))])
    expect([ran.code, (manifestOf(theme).phonePreviews as unknown[]).length]).toEqual([0, 24])
  })

  /** Each refusal: what it is, the picks, and its one reason (given the screenshots folder). */
  const refusals: Array<[string, string[], (folder: string) => string]> = [
    ['a file that is no PNG or JPEG', ['night=notes.png'], () => 'notes.png: its bytes are not a PNG or a JPEG image.'],
    ['a file over 512 KB', ['night=big.jpg'], () => (
      `big.jpg is ${IMAGE_CAP + 1} bytes: a phone screenshot must be 512 KB or smaller, as core's reader holds it.`
    )],
    ['a file outside the folder', ['night=../outside.png'], (folder) => `../outside.png is not inside the screenshots folder ${folder}.`],
    ['a file that is not there', ['night=gone.png'], (folder) => `gone.png: there is no such file in ${folder}.`],
    ['a name no preset claims', ['sunset=a.png'], () => (
      '"sunset" belongs to no preset: a phone screenshot is named <preset> or <preset>-<screen>, and its presets are default, night.'
    )],
    ['a name that is no file name', ['night/chat=a.png'], () => (
      '"night/chat" can\'t name a phone screenshot: core takes assets/previews/phone/<name>.png or .jpg, the name letters, '
      + 'digits, ".", "_" and "-", starting with a letter or digit, at most 128 characters.'
    )],
    ['one name picked twice, as a PNG and a JPEG', ['night=a.png', 'night=b.jpg'], () => (
      '"night" is picked twice: each phone screenshot is one file.'
    )],
    ['more than 24 phone screenshots', Array.from({ length: 25 }, (_, index) => `night-s${index}=a.png`), () => (
      'theme.json: "phonePreviews" must list up to 24 different assets/previews/phone/*.png or *.jpg files.'
    )],
  ]

  it.each(refusals)('refuses %s with one reason, and writes nothing', async (_label, given, reason) => {
    const theme = helloFolder()
    const before = readFileSync(join(theme, MANIFEST), 'utf8')
    const folder = screenshots({ 'a.png': png(1), 'b.jpg': jpeg(2), 'notes.png': 'not an image\n', 'big.jpg': jpeg(3, IMAGE_CAP + 1) })
    const ran = await ranPreviews([theme, '--phone', folder, ...picks(...given)])
    expect([ran.code, ran.err.slice(1), ran.out]).toEqual([1, [`  ${reason(folder)}`], []])
    expect(readFileSync(join(theme, MANIFEST), 'utf8')).toBe(before)
    expect(existsSync(join(theme, PHONE))).toBe(false)
  })

  it('refuses a folder with no picture in it, a picture no preset claims, and a --phone that is no folder', async () => {
    const theme = helloFolder()
    const empty = screenshots({ 'notes.txt': 'not a picture\n' })
    expect((await ranPreviews([theme, '--phone', empty])).err.slice(1)).toEqual([
      `  ${empty} holds no .png, .jpg or .jpeg file: put the theme's Automatos Go screenshots there, named <preset> or `
      + '<preset>-<screen>, or pick each with --pick <name>=<file>.',
    ])
    const stray = await ranPreviews([theme, '--phone', screenshots({ 'default.png': png(1), 'sunset.png': png(2) })])
    expect([stray.code, stray.err.length]).toEqual([1, 2])
    expect(stray.err[1]).toMatch(/^ {2}"sunset" belongs to no preset/)
    const missing = join(tempFolder(), 'missing')
    expect((await ranPreviews([theme, '--phone', missing])).err.slice(1)).toEqual([
      `  ${missing} is not a folder: --phone takes the folder that holds the phone screenshots.`,
    ])
    expect(existsSync(join(theme, PHONE))).toBe(false)
  })
})

describe('the web and phone lists side by side', () => {
  it('a web run leaves the phone list and its folder alone, and warns of no folder in assets/previews/', async () => {
    const theme = helloFolder()
    expect((await ranPreviews([theme, '--phone', screenshots({ 'default.jpg': jpeg(1) })])).code).toBe(0)
    const shots = screenshots({ 'chromium/default/1440/slot-frame-1.png': png(2), 'chromium/night/1440/slot-frame-1.png': png(3) })
    const web = await ranPreviews([theme, '--from', shots])
    expect([web.code, web.err]).toEqual([0, []])
    expect(manifestOf(theme)).toMatchObject({
      previews: [`${WEB}/default.png`, `${WEB}/night.png`], phonePreviews: [phonePath('default.jpg')],
    })
    expect(existsSync(join(theme, phonePath('default.jpg')))).toBe(true)
  })

  it("a phone run warns of a phone screenshot the list no longer names, and never of the web's previews", async () => {
    const theme = helloFolder()
    const folder = screenshots({ 'default.jpg': jpeg(1), 'night.png': png(2) })
    expect((await ranPreviews([theme, '--phone', folder, ...picks('default=default.jpg', 'night=night.png')])).code).toBe(0)
    const ran = await ranPreviews([theme, '--phone', folder, ...picks('night=night.png')])
    expect(ran.err).toEqual([
      `warning: ${phonePath('default.jpg')} is in ${theme} but theme.json no longer lists it; pack still packs it, so delete it or pick it again.`,
    ])
  })

  it.each([
    [['theme', '--from', 'shots', '--phone', 'phone']],
    [['theme', '--phone']],
    [['theme', '--phone', 'phone', '--pick', 'night']],
  ])('previews %j: the usage, exit 2', async (argv) => {
    const ran = await ranPreviews(argv)
    expect([ran.code, ran.err, ran.out]).toEqual([2, [PREVIEWS_USAGE], []])
  })
})
