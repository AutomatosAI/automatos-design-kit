// @vitest-environment node
// PRD-261 C-06q2: Play's listing previews. theme.json's `previews` names the files in assets/previews/, no more and
// no fewer, 1 to 16 of them (core's manifest.py MAX_FILES_LISTED). The Marketplace listing (core's
// orchestrator/services/themes/listings.py, `_owner_preset`) shows each preview under the preset its file stem
// names: `<preset>`, or `<preset>-<screen>`, the longest matching preset id winning; that rule is ported here and
// every stem must have an owner among the presets Play packs (looks/presets/<id>.look.json, as the build writes
// them). Each file is a PNG (package.py IS_PNG) of at most core's IMAGE_MAX_BYTES, the cap a preview has.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lookFiles, PRESET_SUFFIX, PRESETS_FOLDER } from '../../../scripts/looks/compile.ts'
import { readThemeFile, THEME_ROOT } from './source-files.ts'

const KB = 1024
/** core's IMAGE_MAX_BYTES (package.py), the cap of a preview. */
const PREVIEW_MAX_BYTES = 512 * KB
/** core's MAX_FILES_LISTED (manifest.py): `previews` lists at most 16 files. */
const MAX_PREVIEWS = 16
const MIN_PREVIEWS = 1
/** listings.py PREVIEW_DIR, PREVIEW_SUFFIX and SCREEN_SEPARATOR. */
const PREVIEW_DIR = 'assets/previews/'
const PREVIEW_SUFFIX = '.png'
const SCREEN_SEPARATOR = '-'
const PREVIEWS_FOLDER = join(THEME_ROOT, 'assets', 'previews')
/** package.py IS_PNG: the eight bytes a PNG starts with. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

interface Owner {
  readonly preset: string | null
  readonly screen: string | null
}

const NO_OWNER: Owner = { preset: null, screen: null }

/** listings.py `_owner_preset`: the preset a preview's file stem belongs to, and its screen; the longest id wins. */
function ownerPreset(stem: string, presets: readonly string[]): Owner {
  const longestFirst = [...presets].sort((a, b) => b.length - a.length)
  for (const preset of longestFirst) {
    if (stem === preset) return { preset, screen: null }
    if (stem.startsWith(preset + SCREEN_SEPARATOR)) {
      return { preset, screen: stem.slice(preset.length + SCREEN_SEPARATOR.length) }
    }
  }
  return NO_OWNER
}

/** The preset ids the package holds, by file name, sorted (look_schema.py `preset_ids`, as listings.py reads them). */
function packedPresetIds(): string[] {
  const prefix = `${PRESETS_FOLDER}/`
  return Array.from(lookFiles().keys())
    .filter((path) => path.startsWith(prefix) && path.endsWith(PRESET_SUFFIX))
    .map((path) => path.slice(prefix.length, -PRESET_SUFFIX.length))
    .sort()
}

/** A preview's file stem, as listings.py cuts it from the package path. */
function stemOf(path: string): string {
  return path.slice(PREVIEW_DIR.length, -PREVIEW_SUFFIX.length)
}

interface PlayManifest {
  readonly previews?: readonly string[]
}

const listed: readonly string[] = (JSON.parse(readThemeFile('theme.json')) as PlayManifest).previews ?? []
/** The folder's files as package paths; a dotfile is never packed (collect.ts). */
const onDisk = readdirSync(PREVIEWS_FOLDER)
  .filter((name) => !name.startsWith('.'))
  .map((name) => `${PREVIEW_DIR}${name}`)
const presets = packedPresetIds()

/** Two preset ids, one the other's prefix, so the longest match decides. */
const NESTED: readonly string[] = ['ember', 'ember-dark']
/** [stem, preset ids, the owner listings.py gives]. */
const OWNER_CASES: [string, readonly string[], Owner][] = [
  ['ember', NESTED, { preset: 'ember', screen: null }],
  ['ember-looks', NESTED, { preset: 'ember', screen: 'looks' }],
  ['ember-dark', NESTED, { preset: 'ember-dark', screen: null }],
  ['ember-dark-chat', NESTED, { preset: 'ember-dark', screen: 'chat' }],
  ['ember-darkish', NESTED, { preset: 'ember', screen: 'darkish' }],
  ['embers', NESTED, NO_OWNER],
  ['home', NESTED, NO_OWNER],
  ['ember', [], NO_OWNER],
]

describe("the port of listings.py's owner rule", () => {
  it.each(OWNER_CASES)('%s among %j belongs to %j', (stem, ids, owner) => {
    expect(ownerPreset(stem, ids)).toEqual(owner)
  })
})

describe("Play's listing previews, assets/previews", () => {
  it("are the files theme.json's previews lists, 1 to 16 of them, each once", () => {
    expect(listed.length).toBeGreaterThanOrEqual(MIN_PREVIEWS)
    expect(listed.length).toBeLessThanOrEqual(MAX_PREVIEWS)
    expect(new Set(listed).size).toBe(listed.length)
    expect([...listed].sort()).toEqual([...onDisk].sort())
  })

  it('belong to the presets Play packs, each one a preview of its own', () => {
    expect(presets.length).toBeGreaterThan(0)
    const plain = listed.map(stemOf).filter((stem) => ownerPreset(stem, presets).screen === null)
    expect(presets.filter((preset) => !plain.includes(preset))).toEqual([])
  })

  it.each([...listed])('%s is named <preset>.png or <preset>-<screen>.png', (path) => {
    expect(path.startsWith(PREVIEW_DIR) && path.endsWith(PREVIEW_SUFFIX)).toBe(true)
    expect(ownerPreset(stemOf(path), presets).preset).not.toBeNull()
  })

  it.each([...listed])('%s is a PNG of at most 512 KB', (path) => {
    const bytes = readFileSync(join(THEME_ROOT, path))
    expect(bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)).toBe(true)
    expect(bytes.length).toBeLessThanOrEqual(PREVIEW_MAX_BYTES)
  })
})
