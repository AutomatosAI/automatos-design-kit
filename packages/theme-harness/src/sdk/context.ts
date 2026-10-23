/**
 * PRD-261 B-02b: the fake of SDK area `context`. It mirrors core's frontend/lib/theme-sdk/context.ts (at
 * 101a0bf33f64fb4f89af81b4293415be60b661ac): each hook hands back a small frozen copy, the same object while
 * nothing changed. Here the host's state is what a test sets through the controls below (host.ts gathers
 * them); a test starts in the local edition, as its one operator, in one workspace, online, with the backend
 * up, at a desktop width, in the light tone and with the OS motion setting read as core reads it.
 */
import type { HostEdition, HostHealth, HostRole, HostThemeLayout, HostTone, HostTrial, HostWorkspace, HostWorkspaceState } from '@automatos/theme-sdk'
import { useMemo, useSyncExternalStore } from 'react'
import { cell } from '../internal/cell.ts'

type Sdk = typeof import('@automatos/theme-sdk')

/** The workspace a test starts in: fake data, Socials not offered. */
export const WORKSPACE_DEFAULTS: HostWorkspace = Object.freeze({
  id: 'workspace-1',
  name: 'Example workspace',
  slug: 'example',
  plan: 'pro',
  socialsAvailable: false,
})

/** The local edition's one operator: the workspace's owner and a platform admin (core's role-context.tsx). */
export const ROLE_DEFAULTS: HostRole = Object.freeze({ workspaceRole: 'owner', systemRole: 'super_admin', isAdmin: true, canEdit: true })
export const EDITION_DEFAULT: HostEdition = 'local'
export const TONE_DEFAULT: HostTone = 'light'
/** A desktop window, at or above DEFAULT_MIN_WIDTH, so the theme draws. */
export const DEFAULT_WIDTH = 1280
/** The active theme's minWidth the harness assumes until a test sets one (theme.json `minWidth`). */
export const DEFAULT_MIN_WIDTH = 1024

/** The backend's health a test sets beside the connection. */
export interface HealthDetails {
  readonly host?: string
  readonly checking?: boolean
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const workspaceState = (workspace: HostWorkspace | null, isLoading = false): HostWorkspaceState => Object.freeze({ workspace, isLoading })

const workspace = cell<HostWorkspaceState>(workspaceState(WORKSPACE_DEFAULTS))
const role = cell<HostRole>(ROLE_DEFAULTS)
const edition = cell<HostEdition>(EDITION_DEFAULT)
const trial = cell<HostTrial | null>(null)
const health = cell<{ readonly connection: HostHealth['connection'] } & HealthDetails>(Object.freeze({ connection: 'connected' }))
const online = cell<boolean>(true)
const reducedMotion = cell<boolean | null>(null)
const tone = cell<HostTone | null>(TONE_DEFAULT)
const width = cell<number | null>(DEFAULT_WIDTH)
const minWidth = cell<number | null>(DEFAULT_MIN_WIDTH)
let checksMade = 0

/** context.ts:92: the workspace as a theme sees it. */
export const useWorkspace = (() => workspace.use()) satisfies Sdk['useWorkspace']

/** context.ts:110: the caller's roles. */
export const useRole = (() => role.use()) satisfies Sdk['useRole']

/** context.ts:124: the edition; fixed for a build, set per test here. */
export const useEdition = (() => edition.use()) satisfies Sdk['useEdition']

/** context.ts:138: the workspace's trial; null in the local edition and until a test sets one. */
export const useTrial = (() => trial.use()) satisfies Sdk['useTrial']

const checkHealth = (): void => {
  checksMade += 1
}

/** context.ts:161: the backend's health as a test set it; `check` is counted (host.healthChecks()). */
export const useHealth = ((): HostHealth => {
  const { connection, host, checking = false } = health.use()
  return useMemo(
    () => Object.freeze(host === undefined ? { connection, checking, check: checkHealth } : { connection, checking, host, check: checkHealth }),
    [connection, checking, host],
  )
}) satisfies Sdk['useHealth']

/** context.ts:29 (hooks/use-online.ts): whether the browser is online, as a test set it. */
export const useOnline = (() => online.use()) satisfies Sdk['useOnline']

const hasMatchMedia = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

function subscribeMotion(onChange: () => void): () => void {
  const unsubscribe = reducedMotion.subscribe(onChange)
  if (!hasMatchMedia()) return unsubscribe
  const query = window.matchMedia(REDUCED_MOTION)
  query.addEventListener('change', onChange)
  return () => {
    unsubscribe()
    query.removeEventListener('change', onChange)
  }
}

/** A test's setting, else the OS setting through matchMedia as core reads it (jsdom has none: motion allowed). */
const reducedMotionNow = (): boolean => reducedMotion.get() ?? (hasMatchMedia() && window.matchMedia(REDUCED_MOTION).matches)

/** context.ts:170 over hooks/use-media-preferences.ts: the user's media preferences. */
export const useMediaPreferences = (() => {
  const reduced = useSyncExternalStore(subscribeMotion, reducedMotionNow, reducedMotionNow)
  return useMemo(() => Object.freeze({ reducedMotion: reduced }), [reduced])
}) satisfies Sdk['useMediaPreferences']

/** The tone a look forces wins over the chosen one, as core's look runtime forces it (looks.ts sets it). */
const forcedTone = cell<HostTone | null>(null)

/** context.ts:176: the tone the page is painted in, forced or chosen. */
export const useTone = ((): HostTone | null => {
  const forced = forcedTone.use()
  const chosen = tone.use()
  return forced ?? chosen
}) satisfies Sdk['useTone']

function layoutOf(at: number | null, min: number | null): HostThemeLayout {
  if (min === null) return 'fallback'
  if (at === null) return 'pending'
  return at < min ? 'fallback' : 'theme'
}

/** context.ts:188 over hooks/use-studio-theme.ts:46: the theme at or above its minWidth, else the host's page. */
export const useThemeLayout = ((): HostThemeLayout => layoutOf(width.use(), minWidth.use())) satisfies Sdk['useThemeLayout']

/** The workspace now, for the other fakes (storage's scope and the look scope follow it, as in core). */
export const currentWorkspace = (): HostWorkspace | null => workspace.get().workspace
export const subscribeWorkspace = workspace.subscribe
export const currentRole = (): HostRole => role.get()
export const currentEdition = (): HostEdition => edition.get()
export const useCurrentRole = role.use
export const useCurrentEdition = edition.use
export const setForcedTone = forcedTone.set

/** The controls of this area, gathered by host.ts. */
export const contextControls = Object.freeze({
  /** The workspace from now on: the defaults with these changes; null when none is loaded; 'loading' while it loads. */
  setWorkspace(changes: Partial<HostWorkspace> | null | 'loading'): void {
    if (changes === 'loading') workspace.set(workspaceState(null, true))
    else workspace.set(workspaceState(changes === null ? null : Object.freeze({ ...WORKSPACE_DEFAULTS, ...changes })))
  },
  /** The caller's roles from now on: the defaults with these changes. */
  setRole(changes: Partial<HostRole>): void {
    role.set(Object.freeze({ ...ROLE_DEFAULTS, ...changes }))
  },
  setEdition(next: HostEdition): void {
    edition.set(next)
  },
  setTrial(next: HostTrial | null): void {
    trial.set(next === null ? null : Object.freeze({ ...next }))
  },
  /** Whether the backend answers from now on, with its host name or an ask in flight when given. */
  setHealth(connection: HostHealth['connection'], details: HealthDetails = {}): void {
    health.set(Object.freeze({ connection, ...details }))
  },
  /** How many times a theme pressed useHealth's check since the last reset. */
  healthChecks(): number {
    return checksMade
  },
  setOnline(next: boolean): void {
    online.set(next)
  },
  /** The OS motion setting from now on; null reads window.matchMedia again, as core does. */
  setReducedMotion(next: boolean | null): void {
    reducedMotion.set(next)
  },
  /** The chosen tone from now on (null: not known yet, as on the server); a look's forced tone still wins. */
  setTone(next: HostTone | null): void {
    tone.set(next)
  },
  /** The window's width from now on; null while it is not known (the server, hydration): 'pending'. */
  setWidth(next: number | null): void {
    width.set(next)
  },
  /** The active theme's minWidth from now on; null when no theme is active: 'fallback'. */
  setMinWidth(next: number | null): void {
    minWidth.set(next)
  },
})

/** Every control's default again. */
export function resetContext(): void {
  workspace.set(workspaceState(WORKSPACE_DEFAULTS))
  role.set(ROLE_DEFAULTS)
  edition.set(EDITION_DEFAULT)
  trial.set(null)
  health.set(Object.freeze({ connection: 'connected' }))
  checksMade = 0
  online.set(true)
  reducedMotion.set(null)
  tone.set(TONE_DEFAULT)
  forcedTone.set(null)
  width.set(DEFAULT_WIDTH)
  minWidth.set(DEFAULT_MIN_WIDTH)
}
