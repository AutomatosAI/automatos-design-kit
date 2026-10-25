// PRD-261 B-02e: the browser harness's mock host, in jsdom. Play's src/entry.ts, loaded through the harness's
// register(host), registers exactly what its theme.json declares; a sample theme (made-up data, registered here)
// drives each toolbar control: the preset (the look runtime and the page's paint and tone), the width (1440, 1024,
// and below minWidth the host's own page), the tone, reduced motion and forced colours, and the view; a register
// or a frame that throws leaves the host's page with core's notice. Then the parts the browser build and the shots
// read: the import map, the paint, the views, the settings in the address, and the shots' plan.
import { defineTheme, useLook, useMediaPreferences, useThemeLayout, useTone, type ThemeRegistrationHost } from '@automatos/theme-sdk'
import type { ThemePackageManifest } from '@automatos/theme-cli/manifest'
import { SHARED_MODULES } from '@automatos/vite-preset'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FAILURE_TEXT, HarnessHost, prepareHost, THEME_FALLBACK_NOTICE } from '../app/host.tsx'
import { host } from '../src/host.ts'
import { CORE_BASE_STYLE_ID } from '../src/host/core-base.ts'
import { HARNESS_IMPORT_MAP, HARNESS_SDK_ENTRY, harnessImportMap, importMapAliases } from '../src/host/import-map.ts'
import { HTML_ATTRS, paintLook, PREVIEW_STYLE_ID, type PrepaintTable } from '../src/host/prepaint.ts'
import { declaredOf, loadTheme, readServedTheme, reportOf, type HarnessTheme, type ServedTheme } from '../src/host/register.ts'
import {
  DEFAULT_SETTINGS, HARNESS_ORIGIN, offOrigin, readSettings, settingsQuery, shotGroups, viewOfPath, viewSlug, type HarnessSettings,
} from '../src/host/router.ts'

// From the string import.meta.url: under jsdom, `new URL()` is jsdom's class, which fileURLToPath refuses.
const PLAY_DIR = `${resolve(dirname(fileURLToPath(import.meta.url)), '../../../themes/play')}${sep}`
const PLAY_ENTRY = `${PLAY_DIR}src/entry.ts`
const NONE = Object.freeze({ slots: [], pages: [], routes: [] })
/** Play's entry pulls its frame's modules through vitest's transform on first import: more than the 5 s default. */
const PLAY_IMPORT_TIMEOUT_MS = 30_000

// ---- a sample theme: made-up data ----

const GROUND = '--sample-ground'
const GLOW = '--sample-glow'
const DUSK = Object.freeze({ schema: 'sample-look/v1', id: 'dusk', name: 'Dusk', sub: 'Dark', ground: 'night' })
const PAPER = Object.freeze({ schema: 'sample-look/v1', id: 'paper', name: 'Paper', sub: 'Light', ground: 'day' })
const PREPAINT: PrepaintTable = {
  knobs: { ground: { night: { [GROUND]: '#101010', [GLOW]: '1' }, day: { [GROUND]: '#fafafa' } } },
  pairs: [],
  numeric: [],
  defaults: { ground: 'night' },
  tone: { knob: 'ground', values: { night: 'dark', day: 'light' } },
}

function sampleManifest(changes: Partial<ThemePackageManifest> = {}): ThemePackageManifest {
  return {
    schema: 'automatos-theme/v1', id: 'example/sample', name: 'Sample', version: '1.0.0',
    engines: { automatos: '^1.1.0', sdk: '^1.1.0' }, base: 'studio', htmlClass: 'sample', minWidth: 1024, tone: 'from-look',
    slots: ['frame@1', 'lookEditor@1', 'styleSheet@1'], pages: { '/chat': { mode: 'own' } }, routes: ['notes'], look: 'dusk',
    ...changes,
  }
}

function Frame({ children }: { readonly children?: ReactNode }) {
  return <div data-testid="frame">{children}</div>
}

function ChatPage() {
  const { reducedMotion } = useMediaPreferences()
  return <p data-testid="chat">{`motion ${reducedMotion ? 'reduced' : 'full'}, layout ${useThemeLayout()}, tone ${String(useTone())}`}</p>
}

function Editor() {
  return <h2>Editing {useLook().look?.name}</h2>
}

function registerAll(registration: ThemeRegistrationHost): void {
  registration.registerSlot('frame@1', Frame)
  registration.registerSlot('lookEditor@1', Editor)
  registration.registerSlot('styleSheet@1', () => <p>Styles</p>)
  registration.registerPage('/chat', ChatPage)
  registration.registerRoute('notes', () => <p>Notes</p>)
}

function sampleTheme(manifest = sampleManifest(), register: (registration: ThemeRegistrationHost) => void = registerAll): HarnessTheme {
  const definition = defineTheme({ register })
  return { manifest, presets: [DUSK, PAPER], prepaint: PREPAINT, loadEntry: () => Promise.resolve({ default: definition }) }
}

/** The harness as main.tsx starts it; returns every settings change it reported for the address. */
function mount(theme: HarnessTheme, changes: Partial<HarnessSettings> = {}): HarnessSettings[] {
  const settings = { ...DEFAULT_SETTINGS, width: 1440, ...changes }
  const written: HarnessSettings[] = []
  prepareHost(theme, settings, window.innerWidth)
  render(<HarnessHost theme={theme} initial={settings} onSettings={(next) => written.push(next)} />)
  return written
}

function themeOf(served: ServedTheme): HarnessTheme {
  if (!served.ok) throw new Error(served.errors.join('\n'))
  return served.theme
}

const html = (): HTMLElement => document.documentElement

beforeEach(() => {
  host.reset()
})

afterEach(() => {
  vi.restoreAllMocks()
  const root = html()
  Array.from(root.attributes).forEach((attribute) => root.removeAttribute(attribute.name))
})

describe('the harness loads a theme as core does', () => {
  it("loading Play's src/entry.ts registers exactly what its theme.json declares", async () => {
    const manifest = JSON.parse(readFileSync(`${PLAY_DIR}theme.json`, 'utf8')) as unknown
    const theme = themeOf(readServedTheme({ manifest, presets: [], prepaint: null }, () => import(/* @vite-ignore */ PLAY_ENTRY)))
    const load = await loadTheme(theme.loadEntry)
    if (load.status !== 'active') throw new Error(load.message)
    const report = reportOf(load.registrations, declaredOf(theme.manifest))
    expect(report.undeclared).toEqual(NONE)
    // Play's frame draws the asleep screen itself (src/entry.ts): asleep@1 is declared, never registered.
    expect(report.missing).toEqual({ ...NONE, slots: ['asleep@1'] })
  }, PLAY_IMPORT_TIMEOUT_MS)

  const entryOf = (register: (registration: ThemeRegistrationHost) => void) => () => Promise.resolve({ default: defineTheme({ register }) })
  it.each([
    ['no register(host)', () => Promise.resolve({}), 'load'],
    ['a slot the host does not serve', entryOf((h) => h.registerSlot('sidebar@1' as string as 'frame@1', Frame)), 'register'],
    ['no frame', entryOf((h) => h.registerPage('/chat', ChatPage)), 'register'],
  ])('an entry with %s does not start', async (_name, loadEntry, reason) => {
    expect(await loadTheme(loadEntry)).toMatchObject({ status: 'failed', reason })
  })

  it("a register that throws leaves the host's page with core's notice, and the theme's class off <html>", async () => {
    mount(sampleTheme(sampleManifest(), () => {
      throw new Error('broke while starting')
    }))
    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent(`${THEME_FALLBACK_NOTICE} ${FAILURE_TEXT.register} broke while starting`)
    expect(screen.getByRole('main', { name: 'Studio: /' })).toBeInTheDocument()
    expect(screen.queryByTestId('frame')).toBeNull()
    expect([html().getAttribute(HTML_ATTRS.status), html().getAttribute(HTML_ATTRS.reason)]).toEqual(['failed', 'register'])
    expect([html().classList.contains('studio'), html().classList.contains('sample')]).toEqual([true, false])
  })

  it("a frame that throws while drawing leaves the host's page with core's notice", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    function BrokenFrame(): ReactNode {
      throw new Error('broke while drawing')
    }
    mount(sampleTheme(sampleManifest(), (registration) => registration.registerSlot('frame@1', BrokenFrame)))
    expect(await screen.findByRole('alert')).toHaveTextContent(`${FAILURE_TEXT.render} broke while drawing`)
    expect(screen.getByRole('main', { name: 'Studio: /' })).toBeInTheDocument()
    expect(html().getAttribute(HTML_ATTRS.reason)).toBe('render')
  })
})

describe('the toolbar', () => {
  it("switches the preset: the look runtime's look, the page's paint and the tone the look sets", async () => {
    const user = userEvent.setup()
    mount(sampleTheme(), { path: '/looks' })
    expect(await screen.findByRole('heading', { name: 'Editing Dusk' })).toBeInTheDocument()
    expect([html().style.getPropertyValue(GROUND), html().style.getPropertyValue(GLOW)]).toEqual(['#101010', '1'])
    expect([html().classList.contains('sample'), html().classList.contains('dark')]).toEqual([true, true])
    expect(screen.getByLabelText(/^Tone/)).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('Look'), 'paper')
    expect(screen.getByRole('heading', { name: 'Editing Paper' })).toBeInTheDocument()
    expect([html().style.getPropertyValue(GROUND), html().style.getPropertyValue(GLOW)]).toEqual(['#fafafa', ''])
    expect([html().classList.contains('light'), html().classList.contains('dark')]).toEqual([true, false])
    expect(screen.getByLabelText(/^Tone/)).toHaveValue('light')
  })

  it("switches the width: 1440 and 1024 draw the theme, below minWidth the host's own page", async () => {
    const user = userEvent.setup()
    mount(sampleTheme(), { path: '/chat' })
    expect(await screen.findByTestId('chat')).toHaveTextContent('layout theme')
    await user.selectOptions(screen.getByLabelText('Width'), '1024')
    expect(screen.getByTestId('chat')).toHaveTextContent('layout theme')
    expect(document.getElementById('harness-stage')).toHaveStyle({ width: '1024px' })
    await user.selectOptions(screen.getByLabelText('Width'), '1023')
    expect(screen.queryByTestId('frame')).toBeNull()
    expect(screen.getByRole('main', { name: 'Studio: /chat' })).toHaveTextContent("narrower than the theme's minWidth (1024 px)")
    await user.selectOptions(screen.getByLabelText('Width'), '1440')
    expect(screen.getByTestId('frame')).toBeInTheDocument()
    expect(screen.getByTestId('chat')).toHaveTextContent('layout theme')
    expect(document.getElementById('harness-stage')).toHaveStyle({ width: '1440px' })
  })

  it('switches the tone of a theme that leaves it to the user', async () => {
    const user = userEvent.setup()
    mount(sampleTheme(sampleManifest({ tone: 'user' })), { path: '/chat' })
    expect(await screen.findByTestId('chat')).toHaveTextContent('tone light')
    await user.selectOptions(screen.getByLabelText('Tone'), 'dark')
    expect(screen.getByTestId('chat')).toHaveTextContent('tone dark')
    expect([html().classList.contains('dark'), html().classList.contains('light')]).toEqual([true, false])
  })

  it("switches reduced motion: the SDK's media preferences and the build's mirrored rules' attribute", async () => {
    const user = userEvent.setup()
    mount(sampleTheme(), { path: '/chat' })
    expect(await screen.findByTestId('chat')).toHaveTextContent('motion full')
    await user.click(screen.getByLabelText('Reduced motion'))
    expect(screen.getByTestId('chat')).toHaveTextContent('motion reduced')
    expect(html().getAttribute(HTML_ATTRS.motion)).toBe('reduce')
  })

  it("switches forced colours: the attribute the preview and the mirrored rules paint under, over core's base", async () => {
    const user = userEvent.setup()
    mount(sampleTheme())
    await screen.findByTestId('frame')
    expect(html().hasAttribute(HTML_ATTRS.forcedColors)).toBe(false)
    expect(document.getElementById(PREVIEW_STYLE_ID)?.textContent).toContain('CanvasText')
    expect(document.head.firstElementChild, "core's base layer, first in <head>").toBe(document.getElementById(CORE_BASE_STYLE_ID))
    await user.click(screen.getByLabelText('Forced colours'))
    expect(html().getAttribute(HTML_ATTRS.forcedColors)).toBe('active')
  })

  it('lists every view and switches between them, the host page inside the frame on /, and the address follows', async () => {
    const user = userEvent.setup()
    const written = mount(sampleTheme())
    expect(await screen.findByRole('region', { name: 'Studio: /' })).toBeInTheDocument()
    const options = Array.from(screen.getByLabelText<HTMLSelectElement>('View').options, (option) => option.textContent)
    expect(options).toEqual(['slot: frame@1', 'slot: lookEditor@1', 'slot: styleSheet@1', 'page: /chat', 'route: notes'])
    await user.selectOptions(screen.getByLabelText('View'), '/x/notes')
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(written[written.length - 1]?.path).toBe('/x/notes')
    expect(settingsQuery(written[written.length - 1] ?? DEFAULT_SETTINGS)).toContain('path=%2Fx%2Fnotes')
  })

  it("gives the frame's own view its own option for a theme that owns /, and draws the host's page in the frame there", async () => {
    const user = userEvent.setup()
    const manifest = sampleManifest({ pages: { '/chat': { mode: 'own' }, '/': { mode: 'own' } } })
    mount(sampleTheme(manifest, (registration) => {
      registerAll(registration)
      registration.registerPage('/', () => <p>Home</p>)
    }))
    expect(await screen.findByText('Home')).toBeInTheDocument()
    const values = Array.from(screen.getByLabelText<HTMLSelectElement>('View').options, (option) => option.value)
    expect(new Set(values).size).toBe(values.length)
    await user.selectOptions(screen.getByLabelText('View'), '/harness/slot/frame@1')
    expect(document.getElementById('harness-stage')).toHaveAttribute('data-harness-view', 'slot:frame@1')
    expect(screen.getByRole('region', { name: 'Studio: /harness/slot/frame@1' })).toBeInTheDocument()
  })
})

describe('what the build and the shots read', () => {
  it('maps the shared modules as core does, the SDK to the fake, and nothing it has no module for', () => {
    expect(Object.keys(HARNESS_IMPORT_MAP.imports)).toEqual([...SHARED_MODULES])
    expect(HARNESS_IMPORT_MAP.imports['@automatos/theme-sdk']).toBe(HARNESS_SDK_ENTRY)
    const aliases = importMapAliases()
    expect(aliases.map((alias) => alias.replacement)).toEqual([HARNESS_SDK_ENTRY])
    expect([aliases[0]?.find.test('@automatos/theme-sdk'), aliases[0]?.find.test('@automatos/theme-sdk/package.json')]).toEqual([true, false])
    expect(() => harnessImportMap(['left-pad'])).toThrow('no module for "left-pad"')
  })

  it("paints the table's default look for a look that does not fit it", () => {
    expect(paintLook(PREPAINT, { ground: 'noon' })).toEqual({ [GROUND]: '#101010', [GLOW]: '1' })
  })

  it('names the view each path shows', () => {
    const served = { slots: ['frame@1', 'lookEditor@1', 'notFound@1'], pages: ['/chat', '/missions/[id]'], routes: ['notes'] }
    expect(viewOfPath('/looks', served)).toEqual({ kind: 'slot', key: 'lookEditor@1', path: '/looks' })
    expect(viewOfPath('/missions/sample-1', served)).toEqual({ kind: 'page', key: '/missions/[id]', path: '/missions/sample-1' })
    expect(viewOfPath('/x/notes', served).kind).toBe('route')
    expect(viewOfPath('/', served).key).toBe('frame@1')
    expect(viewOfPath('/agents', served)).toEqual({ kind: 'base', key: '/agents', path: '/agents' })
    expect(viewSlug(viewOfPath('/looks', served))).toBe('slot-lookEditor-1')
  })

  it('reads back the settings it writes into the address, and drops a malformed value', () => {
    const settings: HarnessSettings = { path: '/x/notes', preset: 'paper', width: 1023, tone: 'dark', reducedMotion: true, forcedColors: true, toolbar: false }
    expect(readSettings(settingsQuery(settings))).toEqual(settings)
    expect(settingsQuery(DEFAULT_SETTINGS)).toBe('')
    expect(readSettings('?path=javascript:x&width=12&tone=blue&preset=../x')).toEqual(DEFAULT_SETTINGS)
  })

  it("plans a shot folder per preset at 1440 and 1024, and one below minWidth; flags a request off the harness's origin", () => {
    const groups = shotGroups(['ember', 'aurora', 'daylight', 'obsidian', 'workshop'], 1024)
    expect(groups).toHaveLength(11)
    expect(groups.slice(0, 2).map((group) => group.folder)).toEqual(['ember/1440', 'ember/1024'])
    expect(groups[10]).toEqual({ folder: 'below-1023', preset: 'ember', width: 1023 })
    const urls = [`${HARNESS_ORIGIN}/harness/a.js`, 'data:image/png;base64,AA==', `blob:${HARNESS_ORIGIN}/id`, 'https://cdn.example.com/x.js']
    expect(offOrigin(urls)).toEqual(['https://cdn.example.com/x.js'])
  })
})
