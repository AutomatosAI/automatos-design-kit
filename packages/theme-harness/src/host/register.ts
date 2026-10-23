/**
 * PRD-261 B-02e: a theme's files and its register(host), as the browser harness reads and runs them.
 *
 * - readServedTheme: the files the build serves (vite.harness.config.ts) checked as core checks them: theme.json
 *   with core's own validator (the kit's vendored package-manifest.ts), each preset a look with its identity, and
 *   boot/prepaint.json's four parts (prepaint.ts).
 * - loadTheme: import the entry, take its default export's register(host) and run it, as core's
 *   frontend/lib/theme-host/loader.ts:63-126 does (at 101a0bf33f64fb4f89af81b4293415be60b661ac): a slot, page or
 *   route the host doesn't serve, something that isn't a component, a second registration of one key and a
 *   missing frame@1 each throw, and a register that throws is unregistered. A failure is the reason core's notice
 *   names ('load' or 'register') and the error's message, never a throw.
 * - reportOf: what theme.json declares that the theme didn't register, and what it registered undeclared. The host
 *   draws only what is both (servedOf): the registry entry it draws from is built from theme.json.
 */
import type { HostLook, ThemeDefinition, ThemeRegistrationHost } from '@automatos/theme-sdk'
import { KNOWN_SLOTS, PAGE_SCOPE, THEME_HOST_VERSION, validateManifest, type ThemePackageManifest } from '@automatos/theme-cli/manifest'
import type { ComponentType } from 'react'
import { SDK_VERSION } from '../sdk/theme.ts'
import { isPrepaintTable, type PrepaintTable } from './prepaint.ts'
import { FRAME_SLOT, presetOrder, type Served } from './router.ts'

/** A component the host draws, with the props its place hands it (frame@1: FrameProps; the rest: none). */
export type ThemeComponent = ComponentType<Readonly<Record<string, unknown>>>

export interface Registrations {
  readonly slots: ReadonlyMap<string, ThemeComponent>
  readonly pages: ReadonlyMap<string, ThemeComponent>
  readonly routes: ReadonlyMap<string, ThemeComponent>
}

/** Why a theme did not start, in core's words (ThemeFailureReason): its entry failed to load, or its register threw. */
export type FailureReason = 'load' | 'register'

export type ThemeLoad =
  | { readonly status: 'active'; readonly registrations: Registrations }
  | { readonly status: 'failed'; readonly reason: FailureReason; readonly message: string }

/** A route under /x/ (constants.ts:78 THEME_ROUTE_PATTERN). */
const THEME_ROUTE_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}(\/[a-z0-9][a-z0-9-]{0,63}){0,3}$/

function isThemeDefinition(value: unknown): value is ThemeDefinition {
  return typeof value === 'object' && value !== null && typeof (value as { register?: unknown }).register === 'function'
}

/** loader.ts:68: the definition a module exports as its default, or a throw saying what is missing. */
export function definitionOf(loaded: unknown): ThemeDefinition {
  const definition = (loaded as { default?: unknown } | null | undefined)?.default
  if (!isThemeDefinition(definition)) throw new Error('the theme entry has no default export with a register(host) function')
  return definition
}

/** loader.ts:75: a function (or class), or an exotic component such as lazy, memo or forwardRef. */
function isComponent(value: unknown): value is ThemeComponent {
  if (typeof value === 'function') return true
  return typeof value === 'object' && value !== null && '$$typeof' in value
}

/** loader.ts:87. */
function keep(into: Map<string, ThemeComponent>, key: string, component: unknown, allowed: (key: string) => boolean, what: string): void {
  if (!allowed(key)) throw new Error(`${what} "${String(key)}" is not one this host serves`)
  if (!isComponent(component)) throw new Error(`${what} "${key}" needs a component`)
  if (into.has(key)) throw new Error(`${what} "${key}" was registered twice`)
  into.set(key, component)
}

interface Collected {
  readonly slots: Map<string, ThemeComponent>
  readonly pages: Map<string, ThemeComponent>
  readonly routes: Map<string, ThemeComponent>
}

/** loader.ts:94. */
function collectingHost(sdkVersion: string, collected: Collected): ThemeRegistrationHost {
  return Object.freeze({
    sdkVersion,
    hostVersion: THEME_HOST_VERSION,
    registerSlot(slot: string, component: unknown): void {
      keep(collected.slots, slot, component, (key) => KNOWN_SLOTS.includes(key), 'slot')
    },
    registerPage(route: string, component: unknown): void {
      keep(collected.pages, route, component, (key) => PAGE_SCOPE.includes(key), 'page')
    },
    registerRoute(path: string, component: unknown): void {
      keep(collected.routes, path, component, (key) => THEME_ROUTE_PATTERN.test(key), 'route')
    },
  })
}

/** loader.ts:115: register(host)'s registrations; a frame is required; a throwing register is unregistered first. */
export function registerTheme(definition: ThemeDefinition, sdkVersion: string = SDK_VERSION): Registrations {
  const collected: Collected = { slots: new Map(), pages: new Map(), routes: new Map() }
  try {
    definition.register(collectingHost(sdkVersion, collected))
    if (!collected.slots.has(FRAME_SLOT)) throw new Error(`the theme registered no "${FRAME_SLOT}" component`)
    return collected
  } catch (error) {
    try {
      definition.unregister?.()
    } catch (cleanup) {
      console.error('[theme-harness] unregister', cleanup)
    }
    throw error
  }
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** Imports the entry and runs its register(host); never throws. */
export async function loadTheme(loadEntry: () => Promise<unknown>): Promise<ThemeLoad> {
  let definition: ThemeDefinition
  try {
    definition = definitionOf(await loadEntry())
  } catch (error) {
    return { status: 'failed', reason: 'load', message: messageOf(error) }
  }
  try {
    return { status: 'active', registrations: registerTheme(definition) }
  } catch (error) {
    return { status: 'failed', reason: 'register', message: messageOf(error) }
  }
}

/** What theme.json declares: its slots, its pages' routes and its routes, in its order. */
export function declaredOf(manifest: ThemePackageManifest): Served {
  return { slots: [...manifest.slots], pages: Object.keys(manifest.pages ?? {}), routes: [...(manifest.routes ?? [])] }
}

export interface RegisterReport {
  /** Declared, not registered. */
  readonly missing: Served
  /** Registered, not declared: the host never draws these. */
  readonly undeclared: Served
}

export function reportOf(registrations: Registrations, declared: Served): RegisterReport {
  const notIn = (keys: Iterable<string>, list: readonly string[]): string[] => Array.from(keys).filter((key) => !list.includes(key))
  return {
    missing: {
      slots: notIn(declared.slots, Array.from(registrations.slots.keys())),
      pages: notIn(declared.pages, Array.from(registrations.pages.keys())),
      routes: notIn(declared.routes, Array.from(registrations.routes.keys())),
    },
    undeclared: {
      slots: notIn(registrations.slots.keys(), declared.slots),
      pages: notIn(registrations.pages.keys(), declared.pages),
      routes: notIn(registrations.routes.keys(), declared.routes),
    },
  }
}

/** What the host draws: declared and registered, in theme.json's order. */
export function servedOf(registrations: Registrations, declared: Served): Served {
  return {
    slots: declared.slots.filter((key) => registrations.slots.has(key)),
    pages: declared.pages.filter((key) => registrations.pages.has(key)),
    routes: declared.routes.filter((key) => registrations.routes.has(key)),
  }
}

// ---- the served files ----

/** The theme folder's files as the build serves them (app/served-theme.d.ts), not yet checked. */
export interface ServedFiles {
  readonly manifest: unknown
  readonly presets: readonly unknown[]
  readonly prepaint: unknown
}

export interface HarnessTheme {
  readonly manifest: ThemePackageManifest
  /** The default look first, the rest by file name (router.ts presetOrder). */
  readonly presets: readonly HostLook[]
  readonly prepaint: PrepaintTable | null
  readonly loadEntry: () => Promise<unknown>
}

export type ServedTheme = { readonly ok: true; readonly theme: HarnessTheme } | { readonly ok: false; readonly errors: readonly string[] }

const LOOK_FIELDS = ['schema', 'id', 'name', 'sub'] as const

function isLook(value: unknown): value is HostLook {
  const fields = value as Readonly<Record<string, unknown>> | null
  return typeof value === 'object' && value !== null && LOOK_FIELDS.every((name) => typeof fields?.[name] === 'string')
}

function orderedPresets(presets: readonly HostLook[], defaultLook: string | undefined): HostLook[] {
  const order = presetOrder(presets.map((look) => look.id), defaultLook)
  return order.map((id) => presets.find((look) => look.id === id)).filter((look): look is HostLook => look !== undefined)
}

/** The files checked as core checks them: theme.json by core's validator, the presets and the prepaint table by shape. */
export function readServedTheme(files: ServedFiles, loadEntry: () => Promise<unknown>): ServedTheme {
  const { manifest, errors } = validateManifest(files.manifest)
  const problems = [
    ...errors.map((error) => `theme.json ${error.path}: ${error.message}`),
    ...(files.presets.every(isLook) ? [] : ['looks/presets: every preset needs a schema, id, name and sub as text.']),
    ...(files.prepaint === null || isPrepaintTable(files.prepaint) ? [] : ['boot/prepaint.json is not a first-paint table.']),
  ]
  if (manifest === null || problems.length > 0) return { ok: false, errors: problems }
  const presets = orderedPresets(files.presets.filter(isLook), manifest.look)
  const prepaint = isPrepaintTable(files.prepaint) ? files.prepaint : null
  return { ok: true, theme: { manifest, presets, prepaint, loadEntry } }
}
