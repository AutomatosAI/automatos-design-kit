/**
 * PRD-261 B-02e: the mock host app. It loads the theme's entry against the harness's fake SDK, runs its
 * register(host) as core's loader does, and draws the view the fake host's path names: the theme's frame around
 * the slot, page or route there (src/host/slots.ts), the host's own page alone below the theme's minWidth, and the
 * host's own page with core's notice once the entry failed to load, its register threw, or something it drew threw
 * (a boundary around the theme, as core's provider falls back on 'render'). Before the theme draws, <html> gets
 * what core's boot puts there (src/host/prepaint.ts): the base's and the theme's classes, the active look's
 * variables, the tone, and the host's status.
 *
 * The toolbar's settings drive the fake host (src/host.ts): the width and minWidth (useThemeLayout), the chosen tone
 * and the one the theme forces (useTone), reduced motion (useMediaPreferences), and the look runtime mounted on the
 * chosen preset (useLook), whose active look the page is painted from, so a look the theme's editor sets paints too.
 * It proves a theme draws, not that core draws it the same way: core's browser lane does that.
 *
 * The phone view (app/phone/built-in.tsx) draws a theme the phone shows in its own built-in layout through this host
 * too, holding the settings itself (`settings`).
 */
import type { HostLook } from '@automatos/theme-sdk'
import { Component, useEffect, useLayoutEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { host } from '../src/host.ts'
import { setForcedTone } from '../src/sdk/context.ts'
import { useLook } from '../src/sdk/looks.ts'
import { useHostPathname } from '../src/sdk/navigation.ts'
import {
  applyHtml, forcedTone, htmlClasses, installPreviewStyle, lookTone, paintLook, paintNames, STUDIO_CLASS, TONE_CLASSES,
  type HostStatus, type ThemeTone,
} from '../src/host/prepaint.ts'
import {
  declaredOf, loadTheme, reportOf, servedOf, type HarnessTheme, type RegisterReport, type ThemeLoad,
} from '../src/host/register.ts'
import {
  EMPTY_SERVED, HARNESS_GLOBAL, STAGE_ID, viewOfPath, viewsOf, type HarnessReport, type HarnessSettings, type Served, type View,
} from '../src/host/router.ts'
import { drawView } from '../src/host/slots.ts'
import { BasePage } from './base-page.tsx'
import { Toolbar } from './toolbar.tsx'

/** core's theme-host-provider.tsx:106 and :108 (at 101a0bf33f64fb4f89af81b4293415be60b661ac). */
export const THEME_FALLBACK_NOTICE = 'The theme could not start, so Studio is showing instead.'
export const FAILURE_TEXT = Object.freeze({
  load: 'Its code failed to load.',
  register: 'It failed while starting.',
  render: 'It failed while drawing the page.',
})

export interface Failure {
  readonly reason: keyof typeof FAILURE_TEXT
  readonly message: string
}

const NOTICE_STYLE: CSSProperties = Object.freeze({
  padding: '12px 16px', background: '#fef2f2', color: '#7f1d1d', borderBottom: '1px solid #b91c1c',
  fontFamily: 'system-ui, sans-serif', fontSize: '14px',
})
const WIDGET_STYLE: CSSProperties = Object.freeze({
  position: 'fixed', right: '16px', bottom: '16px', padding: '8px 12px', borderRadius: '999px',
  background: '#18181b', color: '#ffffff', fontFamily: 'system-ui, sans-serif', fontSize: '13px',
})
/**
 * What the host hands the frame as its Auto widget: a labelled stand-in for core's floating one, bottom right on
 * every page but /chat (components/layout/main-layout.tsx:243-246 at 101a0bf33f64fb4f89af81b4293415be60b661ac).
 */
const CHAT_PATH = '/chat'
const AUTO_WIDGET = (
  <div data-harness-stand-in="auto-widget" style={WIDGET_STYLE}>
    Auto (the host&apos;s widget)
  </div>
)

/** The stage at the chosen width, or the window's whole width. */
const stageStyle = (width: number | null): CSSProperties => ({ width: width === null ? '100%' : `${width}px` })

const asValues = (look: HostLook): Readonly<Record<string, unknown>> => look as unknown as Readonly<Record<string, unknown>>

/** The preset a setting names, else the theme's default look (its first); null for a theme with none. */
export function presetOf(theme: HarnessTheme, id: string | null): HostLook | null {
  return theme.presets.find((look) => look.id === id) ?? theme.presets[0] ?? null
}

/** The tone the theme forces for a look: its look's (tone 'from-look'), its own ('light', 'dark'), else none. */
export function themeTone(theme: HarnessTheme, look: HostLook | null): ThemeTone | null {
  return forcedTone(theme.manifest.tone, lookTone(theme.prepaint, look === null ? null : asValues(look)))
}

/** Mounts the look runtime on the chosen preset, as core's runtime mounts on the boot's look; none without presets. */
export function mountLooks(theme: HarnessTheme, settings: HarnessSettings): void {
  const look = presetOf(theme, settings.preset)
  if (look === null) {
    host.setLooks(null)
    setForcedTone(themeTone(theme, null))
    return
  }
  host.setLooks({ look, defaultLook: theme.presets[0], tone: themeTone(theme, look) })
}

/** The fake host's width, minWidth, chosen tone and reduced motion for the settings. */
export function applySettings(theme: HarnessTheme, settings: HarnessSettings, windowWidth: number): void {
  host.setMinWidth(theme.manifest.minWidth)
  host.setWidth(settings.width ?? windowWidth)
  host.setTone(settings.tone)
  host.setReducedMotion(settings.reducedMotion)
}

/** The fake host as the settings start it, before the first render: the settings, the look runtime and the path. */
export function prepareHost(theme: HarnessTheme, settings: HarnessSettings, windowWidth: number): void {
  applySettings(theme, settings, windowWidth)
  mountLooks(theme, settings)
  host.setPathname(settings.path)
}

/** Catches what the theme throws while drawing, so the host can fall back. */
class ThemeBoundary extends Component<{ readonly onError: (error: unknown) => void; readonly children: ReactNode }, { readonly failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError(error)
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children
  }
}

function FailureNotice({ failure }: { readonly failure: Failure }) {
  return (
    <div role="alert" style={NOTICE_STYLE}>
      <strong>{THEME_FALLBACK_NOTICE}</strong> {FAILURE_TEXT[failure.reason]} <code>{failure.message}</code>
    </div>
  )
}

interface StageProps {
  readonly theme: HarnessTheme
  readonly load: ThemeLoad | null
  readonly failure: Failure | null
  readonly view: View
  readonly width: number
  readonly onRenderError: (error: unknown) => void
}

/** The view: nothing while loading, the host's page once the theme failed or below its minWidth, else the theme's. */
function Stage({ theme, load, failure, view, width, onRenderError }: StageProps) {
  const { base, minWidth } = theme.manifest
  if (load === null) return null
  if (failure !== null || load.status !== 'active') return <BasePage base={base} path={view.path} reason="failed" minWidth={minWidth} />
  if (width < minWidth) return <BasePage base={base} path={view.path} reason="narrow" minWidth={minWidth} />
  const basePage = (path: string) => <BasePage base={base} path={path} reason="in-frame" minWidth={minWidth} />
  const autoWidget = view.path.startsWith(CHAT_PATH) ? undefined : AUTO_WIDGET
  return <ThemeBoundary onError={onRenderError}>{drawView(view, load.registrations, { basePage, autoWidget })}</ThemeBoundary>
}

function useThemeLoad(theme: HarnessTheme): ThemeLoad | null {
  const [load, setLoad] = useState<ThemeLoad | null>(null)
  useEffect(() => {
    let live = true
    setLoad(null)
    void loadTheme(theme.loadEntry).then((result) => {
      if (live) setLoad(result)
    })
    return () => {
      live = false
    }
  }, [theme])
  return load
}

function useWindowWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = (): void => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

interface Painted {
  readonly status: HostStatus
  readonly reason: Failure['reason'] | null
  readonly tone: ThemeTone
  readonly look: HostLook | null
  readonly settings: HarnessSettings
}

/** <html> for the theme now; the theme's class and its look come off once it failed, as core's cleanup takes them. */
function useHtmlPaint(theme: HarnessTheme, { status, reason, tone, look, settings }: Painted): void {
  const { base, htmlClass } = theme.manifest
  const { reducedMotion, forcedColors } = settings
  useEffect(() => {
    installPreviewStyle(document)
  }, [])
  useLayoutEffect(() => {
    const running = status !== 'failed'
    const vars = running && theme.prepaint !== null && look !== null ? paintLook(theme.prepaint, asValues(look)) : {}
    const names = theme.prepaint === null ? [] : paintNames(theme.prepaint)
    const classes = htmlClasses(base, running ? htmlClass : null, tone)
    const paint = { classes, vars, names, status, reason, reducedMotion, forcedColors }
    applyHtml(document.documentElement, paint, [STUDIO_CLASS, htmlClass, ...TONE_CLASSES])
  }, [theme, base, htmlClass, status, reason, tone, look, reducedMotion, forcedColors])
}

/** What the host serves (declared and registered) and what it left out, once the theme is active. */
function useServed(theme: HarnessTheme, load: ThemeLoad | null): { readonly served: Served; readonly report: RegisterReport | null } {
  const declared = useMemo(() => declaredOf(theme.manifest), [theme])
  const active = load?.status === 'active' ? load : null
  const served = useMemo(() => (active === null ? EMPTY_SERVED : servedOf(active.registrations, declared)), [active, declared])
  const report = useMemo(() => (active === null ? null : reportOf(active.registrations, declared)), [active, declared])
  return { served, report }
}

interface HostInputs {
  readonly settings: HarnessSettings
  readonly windowWidth: number
  readonly forced: ThemeTone | null
  readonly path: string
  readonly onSettings: ((settings: HarnessSettings) => void) | undefined
}

/** The fake host follows the settings and the forced tone; the caller hears every change with the path. */
function useHostInputs(theme: HarnessTheme, { settings, windowWidth, forced, path, onSettings }: HostInputs): void {
  // Block bodies: an effect may return only its cleanup, and these calls return values (a cell's set, a caller's
  // onSettings) that React would try to call as one.
  useEffect(() => {
    applySettings(theme, settings, windowWidth)
  }, [theme, settings, windowWidth])
  useEffect(() => {
    setForcedTone(forced)
  }, [forced])
  useEffect(() => {
    onSettings?.({ ...settings, path })
  }, [settings, path, onSettings])
}

/** What the shots read once the theme loaded or failed (HARNESS_GLOBAL): the views it drew, and what it left out. */
function usePublishedReport(theme: HarnessTheme, status: HostStatus, served: Served, missing: Served): void {
  useEffect(() => {
    if (status === 'loading') return
    const report: HarnessReport = {
      status, views: viewsOf(served), missing, presets: theme.presets.map((look) => look.id), minWidth: theme.manifest.minWidth,
    }
    Reflect.set(window, HARNESS_GLOBAL, Object.freeze(report))
  }, [theme, status, served, missing])
}

export interface HarnessHostProps {
  readonly theme: HarnessTheme
  /** The settings the page opened with; prepareHost has already set the fake host to them. */
  readonly initial: HarnessSettings
  /** Every change, with the fake host's path, for the address bar. */
  readonly onSettings?: (settings: HarnessSettings) => void
  /** Settings the caller holds (the phone view's); left out, the toolbar's own, from `initial`. */
  readonly settings?: HarnessSettings
}

export function HarnessHost({ theme, initial, onSettings, settings: held }: HarnessHostProps) {
  const [own, setSettings] = useState(initial)
  const settings = held ?? own
  const [renderFailure, setRenderFailure] = useState<Failure | null>(null)
  const load = useThemeLoad(theme)
  const path = useHostPathname()
  const windowWidth = useWindowWidth()
  const look = useLook().look ?? presetOf(theme, settings.preset)
  const forced = themeTone(theme, look)
  const { served, report } = useServed(theme, load)
  const failure = renderFailure ?? (load?.status === 'failed' ? { reason: load.reason, message: load.message } : null)
  const status: HostStatus = load === null ? 'loading' : failure === null ? 'active' : 'failed'
  useHostInputs(theme, { settings, windowWidth, forced, path, onSettings })
  useHtmlPaint(theme, { status, reason: failure?.reason ?? null, tone: forced ?? settings.tone, look, settings })
  usePublishedReport(theme, status, served, report?.missing ?? EMPTY_SERVED)
  const change = (next: HarnessSettings): void => {
    if (next.preset !== settings.preset) mountLooks(theme, next)
    setSettings(next)
  }
  const onRenderError = (error: unknown): void => {
    setRenderFailure({ reason: 'render', message: error instanceof Error ? error.message : String(error) })
  }
  const view = viewOfPath(path, served)
  const width = settings.width ?? windowWidth
  const stage = <Stage theme={theme} load={load} failure={failure} view={view} width={width} onRenderError={onRenderError} />
  return (
    <>
      {settings.toolbar ? (
        <Toolbar
          settings={settings}
          path={path}
          views={viewsOf(served)}
          presets={theme.presets}
          minWidth={theme.manifest.minWidth}
          forcedTone={forced}
          report={report}
          onChange={change}
          onPath={(next) => host.setPathname(next)}
        />
      ) : null}
      {failure === null ? null : <FailureNotice failure={failure} />}
      <div id={STAGE_ID} data-harness-view={`${view.kind}:${view.key}`} style={stageStyle(settings.width)}>
        {stage}
      </div>
    </>
  )
}
