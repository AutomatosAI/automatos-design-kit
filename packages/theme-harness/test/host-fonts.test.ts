// @vitest-environment node
// The host's fonts the harness page loads (app/fonts/core): core's own files, byte for byte. Kit CI has no core
// checkout, so each file is held to the sha256 the folder's README pins beside the core commit it names. The README
// lists exactly the folder's files, a face for each font file under one of core's three variables, and each face's
// licence file, which sits beside it and is the SIL Open Font License 1.1.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CORE_FONT_VARIABLES, HOST_FONTS_DIR, HOST_FONTS_README, readHostFonts, sha256Of } from './host-fonts-readme.ts'

const FONT_SUFFIX = '.woff2'
const OFL_NOTICE = 'This Font Software is licensed under the SIL Open Font License, Version 1.1.'
const OFL_TITLE = 'SIL OPEN FONT LICENSE Version 1.1'
const SHA256 = /^[0-9a-f]{64}$/

const { faces, files } = readHostFonts()
const folder = readdirSync(HOST_FONTS_DIR).filter((name) => name !== HOST_FONTS_README).sort()
const licences = [...new Set(faces.map((face) => face.licence))].sort()

describe("the host's font files", () => {
  it('the README pins every file in the folder, once, and no other', () => {
    expect(files.length).toBeGreaterThan(0)
    expect(files.map((pinned) => pinned.file).sort()).toEqual(folder)
  })

  it.each(files)('$file has the sha256 the README pins', ({ file, sha256 }) => {
    expect(sha256).toMatch(SHA256)
    expect(sha256Of(readFileSync(join(HOST_FONTS_DIR, file)))).toBe(sha256)
  })
})

describe("the host's faces", () => {
  it('the README has one face for each font file in the folder', () => {
    expect(faces.map((face) => face.file).sort()).toEqual(folder.filter((name) => name.endsWith(FONT_SUFFIX)))
  })

  it("puts the faces under core's three variables, each with at least one", () => {
    expect([...new Set(faces.map((face) => face.variable))]).toEqual([...CORE_FONT_VARIABLES])
  })

  it('names each licence file in the folder, and every one is named', () => {
    expect(licences).toEqual(folder.filter((name) => !name.endsWith(FONT_SUFFIX)))
  })

  it.each(licences)('%s is the SIL Open Font License 1.1', (licence) => {
    const text = readFileSync(join(HOST_FONTS_DIR, licence), 'utf8')
    expect(text).toContain(OFL_NOTICE)
    expect(text).toContain(OFL_TITLE)
  })
})
