// PRD-261 E3g: Play keeps its own state only through the SDK's storage area. Its source names no browser
// storage (the Marketplace review's JS rules, packages/theme-rules, read comments and strings too),
// and Auto's pause, his hello and the seen Deliverables live under the keys, lifetimes and scopes the plan
// names, on the harness's storage area (packages/theme-harness, core's storage area ported), whose own rules
// are held to core's here as well, through the fake host's controls (host.setStorage).
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  readThemeState, removeThemeState, subscribeThemeState, THEME_STATE_LIMITS, writeThemeState,
  type Deliverable, type ThemeStateOptions, type ThemeStateValue,
} from '@automatos/theme-sdk'
import { host, STORAGE_DEFAULTS, THEME_STATE_KEY_PREFIX } from '@automatos/theme-harness/host'
import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createElement, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AutoMascot } from '../src/components/mascot/auto-mascot.tsx'
import { PAUSE_AUTO } from '@automatos/mascot/mascot-pause-button'
import { useMascotMotion } from '../src/components/mascot/use-mascot-motion.ts'
import { useAutoMascot } from '../src/hooks/use-auto-mascot.ts'
import { useCelebrateNew } from '../src/hooks/use-celebrate-new.ts'
import { mascotPause, PAUSE_KEY, PAUSE_STATE, setMascotPaused, subscribeMascotPause } from '../src/lib/mascot/pause.ts'
import { claimFirstOpen, HELLO_KEY, HELLO_STATE } from '../src/lib/mascot/session.ts'
import { markSeen, readSeen, SEEN_CAP, SEEN_KEY, SEEN_STATE, subscribeSeen, writeSeen } from '../src/lib/play/seen.ts'
import { readSource, readThemeFile, SOURCE_ROOT, THEME_ROOT } from './source-files.ts'

/** The JS rules' four names (JS_LOCAL_STORAGE, JS_SESSION_STORAGE, JS_INDEXED_DB, JS_COOKIE), and a spelling of each. */
const BROWSER_STORAGE = [/\blocalStorage\b/, /\bsessionStorage\b/, /\bindexedDB\b/, /\bdocument\s*\.\s*cookie\b/]
const BROWSER_STORAGE_SPELT = ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie']
/** What the move to the storage area dropped (PRD-261 E1): the look scope's move of old records, and the old keys. */
const DROPPED = ['moveUnscopedOnce', 'UNSCOPED_SEEN_MOVED_KEY', 'automatos-play.', 'automatos-play:']
const STORAGE_TYPES = join(THEME_ROOT, '..', '..', 'packages', 'theme-sdk', 'areas', 'storage.d.ts')
/** core's key scheme for Play, the local edition's user and the fake host's workspace (plan §2.2.1). */
const BROWSER_ACCOUNT = 'automatos-theme-state:v1:b:automatos/play:u:local'
const SESSION_ACCOUNT = 'automatos-theme-state:v1:s:automatos/play:u:local'
const BROWSER_WORKSPACE = 'automatos-theme-state:v1:b:automatos/play:w:workspace-1:u:local'
const PROBE = 'probe'
/** The renders after which a hook that keeps waking itself is stopped, so its test fails instead of looping. */
const RENDER_LIMIT = 20

const deliverable = (id: string, created: string): Deliverable => ({ id, created_at: created }) as Deliverable
const FIRST = deliverable('a', '2026-01-01T00:00:00Z')
const SECOND = deliverable('b', '2026-01-02T00:00:00Z')
const BOTH: readonly Deliverable[] = [FIRST, SECOND]

/** Every file under src/, as an absolute path. */
function sourceFiles(): string[] {
  return readdirSync(SOURCE_ROOT, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
}

function themeStateKeys(storage: Storage): string[] {
  return Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => key !== null && key.startsWith(THEME_STATE_KEY_PREFIX))
}

/** The data of the blob stored under `key`, or null when there is none. */
function blobData(storage: Storage, key: string): unknown {
  const raw = storage.getItem(key)
  return raw === null ? null : (JSON.parse(raw) as { readonly data?: unknown }).data
}

/** `levels` arrays, one inside the other, around a 0. */
const nested = (levels: number): unknown => (levels === 0 ? 0 : [nested(levels - 1)])
const loose = (value: unknown): ThemeStateValue => value as ThemeStateValue

/** An object that holds itself. */
function cycle(): unknown {
  const self: Record<string, unknown> = {}
  self.self = self
  return self
}

/** Play's chat page's use of the driver (play-chat-view.tsx usePlayAuto): greet whenever greet changes; Auto's state as text. */
function Greeter() {
  const auto = useAutoMascot()
  const { greet } = auto
  useEffect(() => {
    greet()
  }, [greet])
  return createElement('output', null, auto.mascot)
}

beforeEach(() => {
  host.reset()
  // Auto may move here (no OS reduced-motion setting), so his clip shows whenever nothing stops it.
  host.setReducedMotion(false)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("Play's own state", () => {
  it('names none of localStorage, sessionStorage, indexedDB and document.cookie in any file under src/', () => {
    const files = sourceFiles()
    expect(files.length).toBeGreaterThan(0)
    const found = files.flatMap((file) => {
      const text = readFileSync(file, 'utf8')
      return BROWSER_STORAGE.filter((name) => name.test(text)).map((name) => `${relative(SOURCE_ROOT, file)}: ${name.source}`)
    })
    expect(found).toEqual([])
    expect(BROWSER_STORAGE.map((name, index) => name.test(BROWSER_STORAGE_SPELT[index]))).toEqual([true, true, true, true])
  })

  it('no longer has the look scope, its move of old records or the old keys (E1)', () => {
    expect(existsSync(join(SOURCE_ROOT, 'lib', 'looks', 'scope.ts'))).toBe(false)
    const text = sourceFiles().map((file) => readFileSync(file, 'utf8')).join('\n')
    expect(DROPPED.filter((name) => text.includes(name))).toEqual([])
    expect(readSource('hooks/use-celebrate-new.ts')).not.toMatch(/\buseLookScope\b/)
  })

  it('is declared: theme.json uses storage, Play 1.3.0 on SDK 1.3.0 and host 1.1.0', () => {
    const manifest = JSON.parse(readThemeFile('theme.json')) as { readonly uses: readonly string[] }
    expect(manifest).toMatchObject({ version: '1.3.0', engines: { automatos: '^1.1.0', sdk: '^1.3.0' } })
    expect(manifest.uses).toContain('storage')
  })
})

describe("the harness's storage area keeps core's rules", () => {
  it('has the caps the vendored declaration names', () => {
    const declared = readFileSync(STORAGE_TYPES, 'utf8')
    const block = /THEME_STATE_LIMITS: Readonly<\{([^}]*)\}>/.exec(declared)?.[1] ?? ''
    const caps = Object.fromEntries(Array.from(block.matchAll(/(\w+): (\d+)/g), (match): [string, number] => [match[1], Number(match[2])]))
    const { keyPattern, ...numbers } = THEME_STATE_LIMITS
    expect(numbers).toEqual(caps)
    expect(declared).toContain(keyPattern)
  })

  it("reads not ready, refuses 'not-ready' and leaves the window's storage alone with no scope", () => {
    host.setStorage({ ready: false })
    const touched = [vi.spyOn(Storage.prototype, 'getItem'), vi.spyOn(Storage.prototype, 'setItem')]
    expect(readThemeState(PROBE)).toMatchObject({ ready: false, value: null })
    expect(writeThemeState(PROBE, true)).toMatchObject({ ok: false, reason: 'not-ready' })
    expect(removeThemeState(PROBE)).toMatchObject({ ok: false, reason: 'not-ready' })
    touched.forEach((spy) => expect(spy).not.toHaveBeenCalled())
  })

  it("keeps each lifetime and scope under core's key, and workspace state waits for the workspace", () => {
    writeThemeState(PROBE, 1)
    writeThemeState(PROBE, 2, { lifetime: 'session' })
    writeThemeState(PROBE, 3, { within: 'workspace' })
    expect(blobData(window.localStorage, BROWSER_ACCOUNT)).toEqual({ [PROBE]: 1 })
    expect(blobData(window.sessionStorage, SESSION_ACCOUNT)).toEqual({ [PROBE]: 2 })
    expect(blobData(window.localStorage, BROWSER_WORKSPACE)).toEqual({ [PROBE]: 3 })
    host.setStorage({ workspaceKey: null })
    expect(readThemeState(PROBE, { within: 'workspace' }).ready).toBe(false)
    expect(readThemeState(PROBE).value).toBe(1)
  })

  it.each([
    ['a function', () => 1],
    ['NaN', Number.NaN],
    ['a Date', new Date(0)],
    ['a cycle', cycle()],
    ['nine levels of nesting', nested(THEME_STATE_LIMITS.depth + 1)],
  ])('refuses %s as bad-value, writing nothing', (_name, value) => {
    expect(writeThemeState(PROBE, loose(value))).toMatchObject({ ok: false, reason: 'bad-value' })
    expect(themeStateKeys(window.localStorage)).toEqual([])
  })

  it('refuses a bad key and bad options, and keeps a value only within the caps', () => {
    expect(writeThemeState('Bad', true)).toMatchObject({ ok: false, reason: 'bad-key' })
    expect(writeThemeState(PROBE, true, { lifetime: 'forever' } as unknown as ThemeStateOptions)).toMatchObject({ ok: false, reason: 'bad-key' })
    expect(writeThemeState(PROBE, 'x'.repeat(THEME_STATE_LIMITS.valueChars))).toMatchObject({ ok: false, reason: 'too-large' })
    expect(writeThemeState(PROBE, loose(nested(THEME_STATE_LIMITS.depth)))).toEqual({ ok: true, persisted: true })
    Array.from({ length: THEME_STATE_LIMITS.keysPerBlob - 1 }, (_, index) => writeThemeState(`key-${index}`, index))
    expect(writeThemeState('one-more', true)).toMatchObject({ ok: false, reason: 'too-large' })
  })

  it('evicts the oldest blob past the per-lifetime cap, never the one written', () => {
    const now = vi.spyOn(Date, 'now')
    for (let user = 0; user <= THEME_STATE_LIMITS.blobsPerLifetime; user += 1) {
      now.mockReturnValue(1_000 + user)
      host.setStorage({ userKey: `user-${user}` })
      writeThemeState(PROBE, user)
    }
    const keys = themeStateKeys(window.localStorage)
    expect(keys).toHaveLength(THEME_STATE_LIMITS.blobsPerLifetime)
    expect(keys).not.toContain(`${THEME_STATE_KEY_PREFIX}b:automatos/play:u:user-0`)
    expect(readThemeState(PROBE).value).toBe(THEME_STATE_LIMITS.blobsPerLifetime)
  })

  it('hands out the same frozen snapshot while the value is unchanged', () => {
    writeThemeState(PROBE, { ids: ['a'] })
    const first = readThemeState(PROBE)
    writeThemeState('other', true)
    expect(readThemeState(PROBE)).toBe(first)
    expect(Object.isFrozen(first) && Object.isFrozen(first.value)).toBe(true)
    writeThemeState(PROBE, { ids: ['a', 'b'] })
    expect(readThemeState(PROBE)).not.toBe(first)
  })

  it('keeps state in memory while the storage is blocked, with one warning in all', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    host.setStorage({ persisted: false })
    expect(writeThemeState(PROBE, true)).toEqual({ ok: true, persisted: false })
    expect(writeThemeState(PROBE, 'tab', { lifetime: 'session' })).toEqual({ ok: true, persisted: false })
    expect(readThemeState(PROBE)).toMatchObject({ ready: true, value: true, persisted: false })
    expect(themeStateKeys(window.localStorage)).toEqual([])
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('tells only the subscribers whose value another tab changed, and all of them when storage is cleared', () => {
    const [probe, other] = [vi.fn(), vi.fn()]
    subscribeThemeState(PROBE, probe)
    subscribeThemeState('other', other)
    host.changeInAnotherTab(PROBE, true)
    expect([probe.mock.calls.length, other.mock.calls.length]).toEqual([1, 0])
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    expect([probe.mock.calls.length, other.mock.calls.length]).toEqual([2, 1])
  })
})

describe("pause: 'mascot-paused', in this browser, for the account", () => {
  it('holds true while Auto is paused and no value otherwise', () => {
    expect([PAUSE_KEY, PAUSE_STATE]).toEqual(['mascot-paused', { lifetime: 'browser', within: 'account' }])
    expect(setMascotPaused(true)).toEqual({ ok: true, persisted: true })
    expect(blobData(window.localStorage, BROWSER_ACCOUNT)).toEqual({ 'mascot-paused': true })
    setMascotPaused(false)
    expect(window.localStorage.getItem(BROWSER_ACCOUNT)).toBeNull()
  })

  it("hands useSyncExternalStore one string: 'unknown' until the host is ready", () => {
    host.setStorage({ ready: false })
    const seen = [mascotPause()]
    host.setStorage({ ready: true })
    seen.push(mascotPause())
    setMascotPaused(true)
    seen.push(mascotPause())
    expect(seen).toEqual(['unknown', 'playing', 'paused'])
  })

  it('keeps Auto a still with an inert toggle while the host is not ready', () => {
    host.setStorage({ ready: false })
    const { result } = renderHook(() => useMascotMotion())
    expect(result.current).toMatchObject({ ready: false, paused: false, still: true })
    act(() => result.current.togglePaused())
    act(() => host.setStorage({ ready: true }))
    expect(result.current).toMatchObject({ ready: true, paused: false, still: false })
    expect(window.localStorage.getItem(BROWSER_ACCOUNT)).toBeNull()
  })

  it('pauses every Auto: a second subscriber sees the first one pressed', () => {
    const first = renderHook(() => useMascotMotion())
    const second = renderHook(() => useMascotMotion())
    act(() => first.result.current.togglePaused())
    expect(second.result.current).toMatchObject({ paused: true, still: true })
  })

  it("calls its subscriber on another tab's storage event", () => {
    const listener = vi.fn()
    subscribeMascotPause(listener)
    host.changeInAnotherTab(PAUSE_KEY, true, PAUSE_STATE)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(mascotPause()).toBe('paused')
  })

  it('starts no clip before the flag is known, and stops it once paused (WCAG 2.2.2)', async () => {
    const user = userEvent.setup()
    host.setStorage({ ready: false })
    const { container } = render(createElement(AutoMascot, { state: 'idle' }))
    expect(container.querySelector('video')).toBeNull()
    expect(container.firstElementChild).toHaveAttribute('data-motion', 'still')
    await user.click(screen.getByRole('button', { name: PAUSE_AUTO }))
    act(() => host.setStorage({ ready: true }))
    expect(mascotPause()).toBe('playing')
    expect(container.querySelector('video')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: PAUSE_AUTO }))
    expect(container.querySelector('video')).toBeNull()
  })
})

describe("hello: 'hello-played', for this tab's session, for the account", () => {
  it('is claimed exactly once per session once the host is ready, and never before', () => {
    expect([HELLO_KEY, HELLO_STATE]).toEqual(['hello-played', { lifetime: 'session', within: 'account' }])
    host.setStorage({ ready: false })
    const claims = [claimFirstOpen(), claimFirstOpen()]
    host.setStorage({ ready: true })
    claims.push(claimFirstOpen(), claimFirstOpen())
    expect(claims).toEqual([false, false, true, false])
    expect(blobData(window.sessionStorage, SESSION_ACCOUNT)).toEqual({ 'hello-played': true })
    expect(themeStateKeys(window.localStorage)).toEqual([])
  })

  it("changes greet's identity when readiness flips, and not on a plain re-render", () => {
    host.setStorage({ ready: false })
    const { result, rerender } = renderHook(() => useAutoMascot())
    const notReady = result.current.greet
    expect(notReady()).toBe(false)
    rerender()
    expect(result.current.greet).toBe(notReady)
    act(() => host.setStorage({ ready: true }))
    expect(result.current.greet).not.toBe(notReady)
  })

  it("lets play-chat-view's effect say hello once, when the host turns ready, and not on a later open", () => {
    host.setStorage({ ready: false })
    const opened = render(createElement(Greeter))
    expect(screen.getByRole('status')).toHaveTextContent('idle')
    act(() => host.setStorage({ ready: true }))
    expect(screen.getByRole('status')).toHaveTextContent('hello')
    opened.unmount()
    render(createElement(Greeter))
    expect(screen.getByRole('status')).toHaveTextContent('idle')
  })
})

describe("seen: 'seen-deliverables', in this browser, for the user in this workspace", () => {
  it('keeps the same record shape under its key, one record per workspace', () => {
    expect([SEEN_KEY, SEEN_STATE]).toEqual(['seen-deliverables', { lifetime: 'browser', within: 'workspace' }])
    const record = { ids: ['a'], newest: FIRST.created_at }
    expect(writeSeen(record)).toBe(true)
    expect(blobData(window.localStorage, BROWSER_WORKSPACE)).toEqual({ 'seen-deliverables': record })
    expect(readSeen()).toEqual({ ready: true, record })
    host.setStorage({ workspaceKey: null })
    expect(readSeen()).toEqual({ ready: false, record: null })
    host.setStorage({ workspaceKey: 'workspace-2' })
    expect(readSeen()).toEqual({ ready: true, record: null })
  })

  it('keeps the newest SEEN_CAP (500) ids', () => {
    const many = Array.from({ length: SEEN_CAP + 1 }, (_, index) => deliverable(`d${index}`, FIRST.created_at))
    const record = markSeen(null, many)
    expect([SEEN_CAP, record.ids.length, record.ids[0]]).toEqual([500, 500, 'd1'])
    expect(writeSeen(record)).toBe(true)
    expect(readSeen().record).toEqual(record)
  })

  it('celebrates a new Deliverable once; the first visit only remembers', () => {
    const celebrate = vi.fn()
    const { result, rerender } = renderHook(({ items }) => useCelebrateNew(items, celebrate), { initialProps: { items: [FIRST] } })
    expect(celebrate).not.toHaveBeenCalled()
    expect(readSeen().record).toEqual({ ids: ['a'], newest: FIRST.created_at })
    rerender({ items: [FIRST, SECOND] })
    expect(celebrate).toHaveBeenCalledTimes(1)
    expect(result.current).toBe(SECOND)
    rerender({ items: [SECOND, FIRST] })
    expect(celebrate).toHaveBeenCalledTimes(1)
  })

  it("writes once for SEEN_CAP + 4 Deliverables, and the host's report of its own write does not wake it", () => {
    const minute = (index: number): string => new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString()
    const items = Array.from({ length: SEEN_CAP + 4 }, (_, index) => deliverable(`m${index}`, minute(index)))
    const [celebrate, written] = [vi.fn(), vi.fn()]
    subscribeSeen(written)
    let renders = 0
    renderHook(() => {
      renders += 1
      if (renders > RENDER_LIMIT) throw new Error(`useCelebrateNew rendered ${renders} times`)
      return useCelebrateNew(items, celebrate)
    })
    expect([written.mock.calls.length, renders]).toEqual([1, 1])
    expect(readSeen().record?.ids).toHaveLength(SEEN_CAP)
    expect(celebrate).not.toHaveBeenCalled()
  })

  it('reads and remembers nothing until the workspace is known', () => {
    host.setStorage({ workspaceKey: null })
    const celebrate = vi.fn()
    renderHook(() => useCelebrateNew(BOTH, celebrate))
    expect(themeStateKeys(window.localStorage)).toEqual([])
    act(() => host.setStorage({ workspaceKey: STORAGE_DEFAULTS.workspaceKey }))
    expect(readSeen().record).toEqual({ ids: ['a', 'b'], newest: SECOND.created_at })
    expect(celebrate).not.toHaveBeenCalled()
  })

  it('logs a refused write (too-large) once, and the record it kept in memory still counts', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const huge = deliverable('x'.repeat(THEME_STATE_LIMITS.valueChars), FIRST.created_at)
    const celebrate = vi.fn()
    const { rerender } = renderHook(({ items }) => useCelebrateNew(items, celebrate), { initialProps: { items: [huge] } })
    expect(themeStateKeys(window.localStorage)).toEqual([])
    rerender({ items: [huge, SECOND] })
    expect(celebrate).toHaveBeenCalledTimes(1)
    rerender({ items: [SECOND, huge] })
    expect(celebrate).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('too-large')
  })
})
