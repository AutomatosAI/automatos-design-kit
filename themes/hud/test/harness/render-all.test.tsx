// Every slot, page and route HUD registers renders in the kit's harness under each of HUD's five presets, with no
// Automatos running and no network: HUD's B-02d proof, after Play's (themes/play/test/harness/render-all.test.tsx,
// Play 1.1.1). src/entry.ts is the module the host imports: its default export, made by the harness's defineTheme,
// registers against a host shaped as core's loader hands one over (one component per key, the SDK's version and the
// host contract's). The views are read from what it registered, so a page or route added later is rendered here too,
// and they are exactly what theme.json declares. Each renders as core's theme host renders it: inside the frame,
// full bleed, behind a boundary that draws nothing until a lazy chunk has loaded (the 404 alone, the whole window).
// Each is awaited with findBy* or waitFor, never a timer: a slot shows its h1 with the host's focus mark
// (data-theme-heading), any other view draws something in the frame's main. The look runtime holds each preset in
// turn, checked by HUD's own look spec and its ground's tone forced from boot/prepaint.json's tone rule, as core's
// does for HUD; under each the frame carries the preset and draws its top bar, rail and the page. After every test
// the harness's network refusal has refused nothing. Screenshots and axe are the harness job's (kit.yml).
import { SDK_VERSION, type ThemeRegistrationHost } from '@automatos/theme-sdk'
import { render, screen, waitFor, within } from '@testing-library/react'
import { Suspense, type ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import hud from '../../src/entry.ts'
import { PRESETS } from '../../src/lib/looks/presets.ts'
import { validateHudLook } from '../../src/lib/looks/spec.ts'
import type { HudLook } from '../../src/lib/looks/types.ts'
import type { FrameSlotProps } from '../../src/slots/frame.tsx'
import { readThemeJson } from '../support/files.ts'

/** What this test reads of HUD's theme.json and first-paint table. */
interface HudManifest {
  readonly slots: readonly string[]
  readonly pages?: Readonly<Record<string, unknown>>
  readonly routes?: readonly string[]
  readonly engines: { readonly automatos: string }
}
interface ToneRule {
  readonly tone: { readonly knob: string; readonly values: Readonly<Record<string, 'light' | 'dark'>> }
}

type Kind = 'slot' | 'page' | 'route'
type Registered = Readonly<Record<Kind, ReadonlyMap<string, unknown>>>
interface View {
  readonly kind: Kind
  readonly key: string
}

const manifest = readThemeJson<HudManifest>('theme.json')
const toneRule = readThemeJson<ToneRule>('boot/prepaint.json').tone

const FRAME = 'frame@1'
/** Slots a theme may declare and draw from its frame, never registering them (core's asleep screen). */
const DRAWN_BY_FRAME: readonly string[] = ['asleep@1']
/** The slot the host draws on its own, the whole window, outside the frame (core's 404). */
const ON_ITS_OWN: readonly string[] = ['notFound@1']
/** The host contract's version on a host HUD admits: the floor of theme.json's engines.automatos range. */
const HOST_VERSION = manifest.engines.automatos.replace(/^\^/, '')
/** A chunk's first load transforms its modules in vitest: wait up to this, under vitest's 5 s test timeout. */
const CHUNK_WAIT = Object.freeze({ timeout: 4_000 })
const PAGE_TEXT = 'The page the host hands the frame'
const WIDGET_TEXT = "Auto's floating widget"
/** The frame's landmarks, as a member sees them. */
const SEEN = Object.freeze({ sidebar: 'Sidebar', mainNav: 'Main', brand: 'Automatos HUD', search: 'Open search (⌘K)' })

/** loader.ts: a function (or class), or an exotic component such as lazy, memo or forwardRef. */
function isComponent(value: unknown): boolean {
  if (typeof value === 'function') return true
  return typeof value === 'object' && value !== null && '$$typeof' in value
}

/** loader.ts: keeps one registration of a kind, refusing a non-component or a second one for the same key. */
function keeper(kind: Kind, into: Map<string, unknown>): (key: string, component: unknown) => void {
  return (key, component) => {
    if (!isComponent(component)) throw new Error(`${kind} "${key}" needs a component`)
    if (into.has(key)) throw new Error(`${kind} "${key}" was registered twice`)
    into.set(key, component)
  }
}

/** Runs HUD's register(host) against a collecting host and returns what it handed over. */
function registerHud(): Registered {
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
  hud.register(registrationHost)
  return Object.freeze({ slot: slots, page: pages, route: routes })
}

const registered = registerHud()

/** Every registration but the frame, each a view of its own: slots, then pages, then routes. */
const VIEWS: readonly View[] = (['slot', 'page', 'route'] as const).flatMap((kind) =>
  [...registered[kind].keys()].filter((key) => key !== FRAME).map((key): View => ({ kind, key })),
)

/** The component HUD registered for a key, as the host renders it. */
function registration<Props extends object>(kind: Kind, key: string): ComponentType<Props> {
  const component = registered[kind].get(key)
  if (component === undefined) throw new Error(`HUD registered no ${kind} "${key}"`)
  return component as ComponentType<Props>
}

const Frame = registration<FrameSlotProps>('slot', FRAME)

/** A view as the host renders it: full bleed in the frame, or the 404 alone, behind a boundary that draws nothing meanwhile. */
function renderView({ kind, key }: View) {
  const Screen = registration<object>(kind, key)
  const content = (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
  return render(ON_ITS_OWN.includes(key) ? content : <Frame fullBleed>{content}</Frame>)
}

/** A look runtime holding `look`, checked by HUD's own look spec, its ground's tone forced, as core's for HUD. */
function mountLook(look: HudLook): void {
  host.setLooks({ look, tone: toneRule.values[look.ground] ?? null, check: validateHudLook })
}

/** What the view draws once it has loaded: a slot its marked h1, any other view something in the frame's main. */
async function expectDrawn(view: View): Promise<void> {
  const stage = screen.getByRole('main')
  if (view.kind !== 'slot') {
    await waitFor(() => expect(stage).not.toBeEmptyDOMElement(), CHUNK_WAIT)
    return
  }
  const headings = await within(stage).findAllByRole('heading', { level: 1 }, CHUNK_WAIT)
  expect(headings.filter((heading) => heading.getAttribute('data-theme-heading') === 'true')).toHaveLength(1)
}

/** The frame's own landmarks under `look`: the look on the frame, the top bar's brand and search, the rail's nav. */
function expectFrame(look: HudLook): void {
  expect(document.querySelector('[data-look]')).toHaveAttribute('data-look', look.id)
  const bar = screen.getByRole('banner')
  expect(within(bar).getByRole('link', { name: SEEN.brand })).toBeInTheDocument()
  expect(within(bar).getByRole('button', { name: SEEN.search })).toBeInTheDocument()
  const rail = screen.getByRole('complementary', { name: SEEN.sidebar })
  expect(within(rail).getByRole('navigation', { name: SEEN.mainNav })).toBeInTheDocument()
}

beforeEach(() => {
  host.reset()
  // jsdom plays no media: under reduced motion Auto is a still, so no clip starts.
  host.setReducedMotion(true)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
})

afterEach(() => {
  // Every render reached the host through the SDK only: the harness's fetch and XMLHttpRequest refused nothing.
  expect(host.networkCalls()).toEqual([])
})

describe("HUD's views", () => {
  it('are every slot, page and route theme.json declares, the frame aside', () => {
    const declared = [
      ...manifest.slots.filter((slot) => slot !== FRAME && !DRAWN_BY_FRAME.includes(slot)),
      ...Object.keys(manifest.pages ?? {}),
      ...(manifest.routes ?? []),
    ]
    expect(VIEWS.map((view) => view.key).sort()).toEqual([...declared].sort())
    expect(VIEWS.length).toBeGreaterThan(0)
  })

  it('force the tone the first-paint table gives each preset ground: dark, every one', () => {
    expect(toneRule.knob).toBe('ground')
    expect(PRESETS.map((look) => toneRule.values[look.ground])).toEqual(PRESETS.map(() => 'dark'))
  })
})

describe.each(PRESETS.map((look): [string, HudLook] => [look.id, look]))('under %s', (_id, look) => {
  beforeEach(() => mountLook(look))

  it('frame@1 draws its top bar and rail around the page in its main, carrying the look, with Auto\'s widget', () => {
    render(
      <Frame autoWidget={<p>{WIDGET_TEXT}</p>}>
        <p>{PAGE_TEXT}</p>
      </Frame>,
    )
    expectFrame(look)
    expect(within(screen.getByRole('main')).getByText(PAGE_TEXT)).toBeInTheDocument()
    expect(screen.getByText(WIDGET_TEXT)).toBeInTheDocument()
  })

  it.each(VIEWS.map((view): [string, View] => [`${view.kind} ${view.key}`, view]))('%s renders in the frame', async (_name, view) => {
    renderView(view)
    if (ON_ITS_OWN.includes(view.key)) {
      expect(await screen.findByRole('heading', { level: 1 }, CHUNK_WAIT)).toBeInTheDocument()
      return
    }
    await expectDrawn(view)
    expectFrame(look)
  })
})
