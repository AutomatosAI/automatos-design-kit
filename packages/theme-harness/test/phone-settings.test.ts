// @vitest-environment node
// The phone view's address: the page answers on PHONE_PATH beside `/` (both servers serve the page there), its
// settings round-trip through the query string, a malformed value is the default's, and no stored look is a value no
// preset id can be. The build lists the theme folder's files under assets/ for it (made-up files in the system temp
// folder), which the phone view gives URLs for only as core's answer does.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PAGE_PATHS, PHONE_PATH } from '../src/host/router.ts'
import { DEFAULT_PHONE_SETTINGS, NO_STORED_LOOK, phoneQuery, readPhoneSettings, type PhoneSettings } from '../src/phone/settings.ts'
import { assetPaths, servedThemeCode } from '../vite.harness.config.ts'

const folders: string[] = []

afterEach(() => {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }))
})

function themeFolder(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), 'phone-assets-'))
  folders.push(root)
  Object.entries(files).forEach(([path, text]) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  })
  return root
}

describe("the phone view's address", () => {
  it('is a page path beside the mock host', () => {
    expect([PHONE_PATH, PAGE_PATHS]).toEqual(['/phone', ['/', '/phone']])
  })

  it.each<PhoneSettings>([
    DEFAULT_PHONE_SETTINGS,
    { screen: 'command-centre', scheme: 'dark', look: 'night', reducedMotion: true },
    { screen: 'first-open', scheme: 'light', look: NO_STORED_LOOK, reducedMotion: false },
  ])('round-trips %o through the query string', (settings) => {
    expect(readPhoneSettings(phoneQuery(settings))).toEqual(settings)
  })

  it('keeps the defaults out of the address, and reads a malformed value as the default', () => {
    expect(phoneQuery(DEFAULT_PHONE_SETTINGS)).toBe('')
    expect(readPhoneSettings('?screen=settings&scheme=dim&look=../x&motion=on')).toEqual(DEFAULT_PHONE_SETTINGS)
  })
})

describe("the theme's asset list", () => {
  it('names every file under assets/, folders joined by /, in order', () => {
    const root = themeFolder({ 'assets/mascot/hello.png': 'p', 'assets/fonts/mobile/Brand.ttf': 'f', 'assets/a.txt': 'a', 'src/x.ts': '' })
    expect(assetPaths(root)).toEqual(['assets/a.txt', 'assets/fonts/mobile/Brand.ttf', 'assets/mascot/hello.png'])
    expect(assetPaths(themeFolder({ 'src/x.ts': '' }))).toEqual([])
  })

  it('reaches the page in the served module', () => {
    const root = themeFolder({ 'theme.json': '{"htmlClass":"sample"}', 'src/entry.ts': 'export default {}', 'assets/mascot/hello.png': 'p' })
    expect(servedThemeCode(root).split('\n')).toContain('export const assets = ["assets/mascot/hello.png"]')
  })
})
