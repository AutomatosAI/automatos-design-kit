// The skin designer's export, files and address (app/phone/designer/), on made-up themes. "Download skin.json" gives
// exactly the draft's mobile block, the one the vendored validator takes and `automatos-theme skin` would write, and
// Copy writes the same text; a draft the command would refuse (a token a scheme needs left out, a pair under its
// minimum, a mascot file the theme lacks) gives every reason and no file. The fonts are the theme's own phone fonts,
// one role each, and the phone declares the one picked. Each change goes into the address, which opens the same draft
// again. automatos/play and automatos/hud, which the phone draws in its own built-in layouts, get no designer and no
// fix, whatever the address says, and the contrast panel measures their own block.
import { mobileErrors } from '@automatos/theme-cli/mobile'
import { measureMobile } from '@automatos/theme-cli/mobile-contrast'
import { skinText, withBlock } from '@automatos/theme-cli/skin-check'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fontLabel, MASCOT_LABEL, STUDIO_FACE } from '../app/phone/designer/asset-fields.tsx'
import { DESIGNER_HEADING } from '../app/phone/designer/designer.tsx'
import { COPY_TEXT, COPY_WORDS, DOWNLOAD_TEXT, REFUSED_TEXT } from '../app/phone/designer/export-panel.tsx'
import { valueLabel } from '../app/phone/designer/token-fields.tsx'
import { PhonePage } from '../app/phone/page.tsx'
import { host } from '../src/host.ts'
import { studioDraft } from '../src/phone/designer.ts'
import { DEFAULT_PHONE_SETTINGS, phoneQuery, readPhoneSettings, type PhoneSettings } from '../src/phone/settings.ts'
import { textOfHref } from '../src/phone/skin-export.ts'
import {
  cssColour, HUD_DIR, NEVER_LOADS, partsNamed, PLAY_DIR, readFolder, renderPhone, servedTheme, skinManifest, slotColour,
  type Json,
} from './phone-support.tsx'

const WHITE = '0 0% 100%'
const INK = '210 16.67% 9.41%'
const PAPER = { '--background': WHITE, '--foreground': INK }
const NIGHT = { '--background': '220 13% 9%', '--foreground': '210 20% 96%' }
const FONT = 'assets/fonts/mobile/Brand.ttf'
const MONO = 'assets/fonts/mobile/Mono.otf'
const MASCOT = { states: ['hello', 'idle'] }
const ASSETS = [FONT, MONO, 'assets/fonts/Web.woff2', 'assets/mascot/hello.png', 'assets/mascot/idle.png']
const BLOCK: Json = { tokens: { light: PAPER, dark: NIGHT }, fonts: { sans: FONT }, mascot: 'stills' }
const THEME = servedTheme({ manifest: skinManifest(BLOCK, { mascot: MASCOT }), presets: [], prepaint: null })

const download = (): HTMLElement | null => screen.queryByRole('link', { name: DOWNLOAD_TEXT })
const exported = (): string => textOfHref(download()?.getAttribute('href') ?? '') ?? ''
const refusals = (): string[] => Array.from(document.querySelectorAll('[data-skin-export="refused"] li'), (item) => item.textContent ?? '')
const setValue = (token: string, value: string): void => {
  fireEvent.change(screen.getByLabelText(valueLabel(token)), { target: { value } })
}
const copyClick = async (): Promise<void> => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: COPY_TEXT }))
  })
}

beforeEach(() => {
  host.reset()
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard')
})

describe('the export', () => {
  it('downloads exactly the block, the one the validator takes, and shows its text', () => {
    renderPhone(THEME, ASSETS)
    expect(exported()).toBe(skinText(BLOCK))
    expect(download()).toHaveAttribute('download', 'skin.json')
    expect(mobileErrors(withBlock(skinManifest(null, { mascot: MASCOT }), JSON.parse(exported())))).toEqual([])
    expect(screen.getByLabelText('skin.json')).toHaveValue(skinText(BLOCK))
    setValue('--ring', '#2563eb')
    expect(exported()).toBe(skinText({ ...BLOCK, tokens: { light: { ...PAPER, '--ring': '#2563eb' }, dark: NIGHT } }))
  })

  it('copies the same text, and says so when the page may not use the clipboard', async () => {
    const writeText = vi.fn((_text: string) => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderPhone(THEME, ASSETS)
    await copyClick()
    expect(await screen.findByText(COPY_WORDS.copied)).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith(skinText(BLOCK))
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    await copyClick()
    expect(await screen.findByText(COPY_WORDS.failed)).toBeInTheDocument()
  })

  it('gives every reason, and no file, for a draft the command would refuse', () => {
    renderPhone(THEME, ASSETS)
    setValue('--background', '')
    expect([download(), screen.queryByRole('button', { name: COPY_TEXT })]).toEqual([null, null])
    expect(screen.getByText(REFUSED_TEXT)).toBeInTheDocument()
    expect(refusals()).toContain('BAD_MOBILE mobile.tokens.light: "mobile.tokens.light" needs "--background".')
    setValue('--background', WHITE)
    setValue('--foreground', '0 0% 60%')
    expect(download()).toBeNull()
    const contrast = 'MOBILE_CONTRAST mobile: mobile.tokens.light: --foreground on --background is 2.85:1'
    expect(refusals().some((reason) => reason.startsWith(contrast))).toBe(true)
    setValue('--foreground', INK)
    expect(download()).not.toBeNull()
    fireEvent.change(screen.getByLabelText(MASCOT_LABEL), { target: { value: 'clips' } })
    expect(download()).toBeNull()
    expect(refusals()).toEqual(expect.arrayContaining([
      expect.stringMatching(/^MISSING_FILE assets\/mascot\/hello\.mp4: /), expect.stringMatching(/^MISSING_FILE assets\/mascot\/idle\.mp4: /),
    ]))
    expect(document.querySelectorAll('[data-skin-file="missing"]')).toHaveLength(2)
  })
})

describe("the theme's files", () => {
  it('offers its own phone fonts, one role each, and the phone declares the one picked', () => {
    renderPhone(THEME, ASSETS)
    const serif = screen.getByLabelText(fontLabel('serif'))
    expect(Array.from(serif.querySelectorAll('option'), (option) => option.textContent)).toEqual([STUDIO_FACE, FONT, MONO])
    expect(serif.querySelector(`option[value="${FONT}"]`)).toBeDisabled()
    fireEvent.change(serif, { target: { value: MONO } })
    const css = Array.from(document.querySelectorAll('style'), (style) => style.textContent ?? '').join('\n')
    expect(css).toContain(`@font-face { font-family: 'go-theme-serif'; src: url("/${MONO}")`)
    expect(JSON.parse(exported())).toMatchObject({ fonts: { sans: FONT, serif: MONO } })
  })
})

describe("the designer's address", () => {
  it('takes each change, and opens the same draft again', () => {
    const seen: PhoneSettings[] = []
    const { unmount } = render(
      <PhonePage theme={THEME} assets={ASSETS} initial={DEFAULT_PHONE_SETTINGS} onSettings={(settings) => seen.push(settings)} />,
    )
    expect(seen.at(-1)?.skin).toBeUndefined()
    setValue('--card', '#f5f0e6')
    fireEvent.change(screen.getByLabelText(fontLabel('mono')), { target: { value: MONO } })
    const query = phoneQuery(seen.at(-1) ?? DEFAULT_PHONE_SETTINGS)
    expect(query).toContain('skin=')
    expect(readPhoneSettings(query)).toEqual(seen.at(-1))
    unmount()
    renderPhone(THEME, ASSETS, readPhoneSettings(query))
    expect(document.querySelector('[data-skin-designer]')).toHaveAttribute('data-skin-designer', 'edited')
    expect(screen.getByLabelText(valueLabel('--card'))).toHaveValue('#f5f0e6')
    expect(screen.getByLabelText(fontLabel('mono'))).toHaveValue(MONO)
    expect(slotColour(partsNamed('card')[0], 'backgroundColor')).toBe(cssColour('#f5f0e6'))
  })
})

describe.each([['automatos/play', PLAY_DIR], ['automatos/hud', HUD_DIR]])('%s', (id, dir) => {
  it('gets no designer and no fix, whatever the address says, and the panel measures its own block', () => {
    const folder = readFolder(dir)
    const manifest = folder.served.manifest as Json
    expect(manifest.id).toBe(id)
    renderPhone(servedTheme(folder.served, NEVER_LOADS), [], { skin: studioDraft() })
    expect(document.querySelector('[data-skin-designer]')).toBeNull()
    expect(screen.queryByRole('heading', { name: DESIGNER_HEADING })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Fix' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Nearest passing/ })).toBeNull()
    expect(document.querySelector('[data-reason]')?.textContent).toBe(measureMobile(manifest, folder.files)?.reason)
  })
})
