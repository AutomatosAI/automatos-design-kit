// PRD-261 B-02d: every slot, page and route Play registers renders in the kit's harness, with no Automatos
// running. src/entry.ts is the module the host imports: its default export, made by the harness's defineTheme,
// registers against a host shaped as core's loader hands one over (frontend/lib/theme-host/loader.ts:75-108 at
// 101a0bf33f64fb4f89af81b4293415be60b661ac: one component per key, the SDK's version and the host contract's),
// and what it registered is what theme.json declares. Each registration renders as core's components/theme-host/
// render it at the same commit: the frame around the page (ThemeFrameSlot); the look editor, the style sheet, the
// two pages and the route full bleed inside the frame, each behind a boundary that draws nothing until its lazy
// chunk has loaded (ThemeSlotPage, ThemeVersion, ThemeSlotRoute); the 404 on its own (app/not-found.tsx,
// ThemeSlot). Each is awaited with findBy*, never a timer, and shows its heading or landmark,
// named here as the screen draws it, so the test never imports a chunk's module itself. With the backend down
// the frame draws the asleep screen (asleep@1 is declared, not registered); the frame renders under each of
// Play's five presets, a look runtime holding the preset as core's does for Play; and after every test the
// harness's network refusal has refused nothing. Screenshots are B-02f's.
import { CHAT_HREF, SDK_VERSION, type ThemeRegistrationHost } from '@automatos/theme-sdk'
import { act, render, screen, within } from '@testing-library/react'
import { Suspense, type ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import play from '../../src/entry.ts'
import { validateLook } from '../../src/lib/looks/engine.ts'
import { findPreset, PRESETS } from '../../src/lib/looks/presets.ts'
import { toneOfGround } from '../../src/lib/looks/tone.ts'
import type { Look } from '../../src/lib/looks/types.ts'
import type { FrameSlotProps } from '../../src/play-slots.tsx'
import { host } from '@automatos/theme-harness/host'
import { readThemeFile } from '../source-files.ts'

/** What this test reads of Play's theme.json. */
interface PlayManifest {
  readonly slots: readonly string[]
  readonly pages: Readonly<Record<string, unknown>>
  readonly routes: readonly string[]
  readonly engines: { readonly automatos: string }
  readonly look: string
}

type Kind = 'slot' | 'page' | 'route'
type Registered = Readonly<Record<Kind, ReadonlyMap<string, unknown>>>

const manifest = JSON.parse(readThemeFile('theme.json')) as PlayManifest

/** Declared in theme.json, never registered: Play's frame draws the asleep screen itself (AsleepGate). */
const DRAWN_BY_FRAME: readonly string[] = ['asleep@1']
/** The host contract's version on a host Play admits: the floor of theme.json's engines.automatos range. */
const HOST_VERSION = manifest.engines.automatos.replace(/^\^/, '')
/** A chunk's first load transforms its modules in vitest: wait up to this, under vitest's 5 s test timeout. */
const CHUNK_WAIT = Object.freeze({ timeout: 4_000 })
/** What the host hands the frame: the page, and Auto's floating widget (MainLayout's autoWidget). */
const PAGE_TEXT = 'The page the host hands the frame'
const WIDGET_TEXT = "Auto's floating widget"

/** Each screen's heading or landmark, as a member sees it. */
const SEEN = Object.freeze({
  sidebar: 'Sidebar',
  mainNav: 'Main',
  search: 'Open search (⌘K)',
  asleep: 'Automatos is asleep',
  checkAgain: 'Check again',
  lookEditor: 'Make it yours.',
  styleSheet: 'Style sheet',
  lost: 'This page wandered off',
  backToChat: 'Back to chat',
  sayHello: 'Say hello',
  messageAuto: 'Message Auto',
  shelf: 'Your shelf',
  conversations: 'Conversations',
  searchConversations: 'Search conversations',
})

/** The style sheet's line naming the active look, as Play reads it from the look runtime. */
const activeLookLine = (look: Look): string => `Every value here comes from ${look.name}, the active look.`

/** loader.ts:75: a function (or class), or an exotic component such as lazy, memo or forwardRef. */
function isComponent(value: unknown): boolean {
  if (typeof value === 'function') return true
  return typeof value === 'object' && value !== null && '$$typeof' in value
}

/** loader.ts:87: keeps one registration of a kind, refusing a non-component or a second one for the same key. */
function keeper(kind: Kind, into: Map<string, unknown>): (key: string, component: unknown) => void {
  return (key, component) => {
    if (!isComponent(component)) throw new Error(`${kind} "${key}" needs a component`)
    if (into.has(key)) throw new Error(`${kind} "${key}" was registered twice`)
    into.set(key, component)
  }
}

/** Runs Play's register(host) against a collecting host (loader.ts:94-108) and returns what it handed over. */
function registerPlay(): Registered {
  const slots = new Map<string, unknown>()
  const pages = new Map<string, unknown>()
  const routes = new Map<string, unknown>()
  const registrationHost: ThemeRegistrationHost = Object.freeze({
    sdkVersion: SDK_VERSION,
    hostVersion: HOST_VERSION,
    registerSlot: keeper('slot', slots),
    registerPage: keeper('page', pages),
    registerRoute: keeper('route', routes),
  })
  play.register(registrationHost)
  return Object.freeze({ slot: slots, page: pages, route: routes })
}

const registered = registerPlay()

/** The component Play registered for a key, as the host renders it. */
function registration<Props extends object>(kind: Kind, key: string): ComponentType<Props> {
  const component = registered[kind].get(key)
  if (component === undefined) throw new Error(`Play registered no ${kind} "${key}"`)
  return component as ComponentType<Props>
}

const Frame = registration<FrameSlotProps>('slot', 'frame@1')

/** A registration full bleed in the frame (MainLayout fullBleed), behind a boundary that draws nothing meanwhile. */
function renderFramed(kind: Kind, key: string) {
  const Screen = registration<object>(kind, key)
  return render(
    <Frame fullBleed>
      <Suspense fallback={null}>
        <Screen />
      </Suspense>
    </Frame>,
  )
}

/** The frame's <main>, where the host's page goes. */
const framedPage = (): HTMLElement => screen.getByRole('main')

/** theme.json's default look, one of Play's presets. */
function themeLook(): Look {
  const look = findPreset(manifest.look)
  if (look === undefined) throw new Error(`theme.json's look "${manifest.look}" is not one of Play's presets`)
  return look
}

/** A look runtime holding `look`, checked by Play's own look spec, its ground's tone forced, as core's for Play. */
function mountLook(look: Look): void {
  host.setLooks({ look, tone: toneOfGround(look.ground), check: validateLook })
}

beforeEach(() => {
  host.reset()
  // jsdom plays no media: under reduced motion Auto is a still, so no clip starts.
  host.setReducedMotion(true)
  mountLook(themeLook())
})

afterEach(() => {
  // Every render reached the host through the SDK only: the harness's fetch and XMLHttpRequest refused nothing.
  expect(host.networkCalls()).toEqual([])
})

describe("Play's entry", () => {
  it("is the harness's defineTheme definition, and registers what theme.json declares against the host", () => {
    expect(Object.isFrozen(play)).toBe(true)
    const declaredSlots = manifest.slots.filter((slot) => !DRAWN_BY_FRAME.includes(slot))
    expect([...registered.slot.keys()].sort()).toEqual([...declaredSlots].sort())
    expect([...registered.page.keys()].sort()).toEqual(Object.keys(manifest.pages).sort())
    expect([...registered.route.keys()]).toEqual([...manifest.routes])
  })
})

describe('frame@1', () => {
  it("draws the sidebar, the header's search and the page in its main, with Auto's widget", async () => {
    render(
      <Frame autoWidget={<p>{WIDGET_TEXT}</p>}>
        <p>{PAGE_TEXT}</p>
      </Frame>,
    )
    const sidebar = await screen.findByRole('complementary', { name: SEEN.sidebar })
    expect(within(sidebar).getByRole('navigation', { name: SEEN.mainNav })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: SEEN.search })).toBeInTheDocument()
    expect(within(framedPage()).getByText(PAGE_TEXT)).toBeInTheDocument()
    expect(screen.getByText(WIDGET_TEXT)).toBeInTheDocument()
  })

  it('draws the asleep screen in place of itself and its page once the backend is down (asleep@1)', async () => {
    render(
      <Frame>
        <p>{PAGE_TEXT}</p>
      </Frame>,
    )
    expect(await screen.findByText(PAGE_TEXT)).toBeInTheDocument()
    act(() => host.setHealth('down'))
    expect(await screen.findByRole('heading', { level: 1, name: SEEN.asleep })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: SEEN.checkAgain })).toBeInTheDocument()
    expect(screen.queryByText(PAGE_TEXT)).toBeNull()
    expect(screen.queryByRole('complementary', { name: SEEN.sidebar })).toBeNull()
  })

  it.each(PRESETS)('renders under the $name preset, the page inside it reading that look', async (look) => {
    mountLook(look)
    renderFramed('slot', 'styleSheet@1')
    const line = await within(framedPage()).findByText(activeLookLine(look), { exact: false }, CHUNK_WAIT)
    expect(line).toBeInTheDocument()
    const sidebar = screen.getByRole('complementary', { name: SEEN.sidebar })
    expect(within(sidebar).getByRole('navigation', { name: SEEN.mainNav })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: SEEN.search })).toBeInTheDocument()
  })
})

describe('the slots', () => {
  it('lookEditor@1: Make it yours, in the frame', async () => {
    renderFramed('slot', 'lookEditor@1')
    const heading = await within(framedPage()).findByRole('heading', { level: 1, name: SEEN.lookEditor }, CHUNK_WAIT)
    expect(heading).toBeInTheDocument()
  })

  it('styleSheet@1: the style sheet, in the frame', async () => {
    renderFramed('slot', 'styleSheet@1')
    const heading = await within(framedPage()).findByRole('heading', { level: 1, name: SEEN.styleSheet }, CHUNK_WAIT)
    expect(heading).toBeInTheDocument()
  })

  it('notFound@1: the 404 on its own, the whole window, with the way back to the chat', async () => {
    const Lost = registration<object>('slot', 'notFound@1')
    render(
      <Suspense fallback={null}>
        <Lost />
      </Suspense>,
    )
    expect(await screen.findByRole('heading', { level: 1, name: SEEN.lost }, CHUNK_WAIT)).toBeInTheDocument()
    const window404 = screen.getByRole('main')
    expect(within(window404).getByRole('link', { name: SEEN.backToChat })).toHaveAttribute('href', CHAT_HREF)
  })
})

describe('the pages and the route', () => {
  it('/chat: a new chat, Auto saying hello over the message box', async () => {
    renderFramed('page', '/chat')
    const page = framedPage()
    expect(await within(page).findByRole('region', { name: SEEN.sayHello }, CHUNK_WAIT)).toBeInTheDocument()
    expect(within(page).getByRole('textbox', { name: SEEN.messageAuto })).toBeInTheDocument()
  })

  it('/deliverables: the shelf', async () => {
    renderFramed('page', '/deliverables')
    const heading = await within(framedPage()).findByRole('heading', { level: 1, name: SEEN.shelf }, CHUNK_WAIT)
    expect(heading).toBeInTheDocument()
  })

  it('the route conversations: the Conversations page and its search', async () => {
    renderFramed('route', 'conversations')
    const page = framedPage()
    const heading = await within(page).findByRole('heading', { level: 1, name: SEEN.conversations }, CHUNK_WAIT)
    expect(heading).toBeInTheDocument()
    expect(within(page).getByRole('searchbox', { name: SEEN.searchConversations })).toBeInTheDocument()
  })
})
