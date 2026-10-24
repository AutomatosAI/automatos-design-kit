// @vitest-environment node
// The made-up theme the phone view's shots draw (fixtures/phone-skin, served by shots/phone-shots.config.ts): a theme
// folder `automatos-theme dev` takes (theme.json and src/entry.ts), whose theme.json core's validator takes and whose
// `mobile` block `automatos-theme skin` would write (skin-check.ts: the validator, the stills its `stills` mascot needs
// for every state, and no pair under its minimum). Both schemes set all ten pairs, so the shots photograph a skin
// that passes `check` in Light and in Dark, each pair measured. Its stills are PNG files within a still's cap.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateManifest } from '@automatos/theme-cli/manifest'
import { MOBILE_CONTRAST_PAIRS } from '@automatos/theme-cli/mobile'
import { checkSkin, skinMascotFiles } from '@automatos/theme-cli/skin-check'
import { describe, expect, it } from 'vitest'

const SKIN_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures/phone-skin')
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
/** A still's cap (theme-cli files.ts IMAGE_MAX_BYTES). */
const STILL_MAX_BYTES = 512 * 1024

type Json = Readonly<Record<string, unknown>>

const manifest = JSON.parse(readFileSync(join(SKIN_DIR, 'theme.json'), 'utf8')) as Json
const block = manifest.mobile
const holds = (path: string): boolean => existsSync(join(SKIN_DIR, path))

describe('the phone skin sample (fixtures/phone-skin)', () => {
  it('is a theme folder the harness draws: theme.json and src/entry.ts', () => {
    expect(holds('theme.json')).toBe(true)
    expect(holds('src/entry.ts')).toBe(true)
  })

  it("core's validator takes its theme.json, mobile block included", () => {
    expect(validateManifest(manifest).errors).toEqual([])
    expect(typeof block).toBe('object')
  })

  it('has a mobile block automatos-theme skin would write, every pair of both schemes measured and passing', () => {
    const checked = checkSkin(manifest, block, { has: holds, measured: new Map() })
    expect(checked.problems).toEqual([])
    expect(checked.measure?.status).toBe('pass')
    const schemes = checked.measure?.schemes ?? []
    expect(schemes.map((scheme) => scheme.id)).toEqual(['light', 'dark'])
    schemes.forEach((scheme) => {
      expect(scheme.pairs).toHaveLength(MOBILE_CONTRAST_PAIRS.length)
      expect(scheme.pairs.filter((pair) => pair.status !== 'pass')).toEqual([])
    })
  })

  it('shows Auto as stills, each state a PNG within the cap', () => {
    const stills = skinMascotFiles(manifest, block)
    expect(stills.length).toBeGreaterThan(0)
    stills.forEach((path) => {
      const bytes = readFileSync(join(SKIN_DIR, path))
      expect(Array.from(bytes.subarray(0, PNG_SIGNATURE.length))).toEqual(PNG_SIGNATURE)
      expect(statSync(join(SKIN_DIR, path)).size).toBeLessThanOrEqual(STILL_MAX_BYTES)
    })
  })
})
