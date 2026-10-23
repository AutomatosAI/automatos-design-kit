// PRD-261 A-13b (F10, WCAG 2.2.2): the Pause Auto flag, moved from core's lib/mascot/__tests__/pause.test.ts
// and rewritten for E3g (PB-10): the flag is kept through the host, in the SDK's storage area (key
// mascot-paused, in this browser, for the account), so every Auto on the page and in other tabs hears it,
// a reload still finds it, and where the browser blocks its storage the host keeps it for the page. Until
// the host can say whose flag it is, it is unknown. Run on the harness's storage area (packages/theme-harness).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isMascotPaused, mascotPause, PAUSE_KEY, PAUSE_STATE, setMascotPaused, subscribeMascotPause } from '../../src/lib/mascot/pause.ts'
import { readThemeState } from '@automatos/theme-sdk'
import { host } from '@automatos/theme-harness/host'
import { blobData, blockedStorage, BROWSER_ACCOUNT, swapWindowStorage, themeStateKeys } from '../support/memory-storage.ts'

/** Where the flag lived before the move to the host (PRD-261 E1): never read again. */
const OLD_PAUSE_KEY = 'automatos-play.mascot-paused'

beforeEach(() => {
  host.reset()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.removeItem(OLD_PAUSE_KEY)
})

describe('the Pause Auto flag', () => {
  it('is off until the user pauses him, and a flag kept before the move to the host does not count', () => {
    window.localStorage.setItem(OLD_PAUSE_KEY, '1')
    expect(mascotPause()).toBe('playing')
    expect(isMascotPaused()).toBe(false)
  })

  it('is kept by the host in this browser for the account, so a remount or a reload still finds him paused', () => {
    expect(setMascotPaused(true)).toEqual({ ok: true, persisted: true })
    expect(blobData(window.localStorage, BROWSER_ACCOUNT)).toEqual({ [PAUSE_KEY]: true })
    expect(readThemeState(PAUSE_KEY, PAUSE_STATE)).toMatchObject({ ready: true, value: true, persisted: true })
    expect(isMascotPaused()).toBe(true)
    expect(setMascotPaused(false)).toEqual({ ok: true, persisted: true })
    expect(window.localStorage.getItem(BROWSER_ACCOUNT)).toBeNull()
    expect(isMascotPaused()).toBe(false)
  })

  it('tells every subscriber when it changes here, until they unsubscribe', () => {
    const first = vi.fn()
    const second = vi.fn()
    const stopFirst = subscribeMascotPause(first)
    const stopSecond = subscribeMascotPause(second)
    setMascotPaused(true)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    stopFirst()
    setMascotPaused(false)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(2)
    stopSecond()
  })

  it('hears another tab pause him (a change of its key, or a cleared store), and ignores other keys', () => {
    const onChange = vi.fn()
    const stop = subscribeMascotPause(onChange)
    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated-key' }))
    host.changeInAnotherTab('other-setting', true, PAUSE_STATE)
    expect(onChange).not.toHaveBeenCalled()
    host.changeInAnotherTab(PAUSE_KEY, true, PAUSE_STATE)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(isMascotPaused()).toBe(true)
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    expect(onChange).toHaveBeenCalledTimes(2)
    stop()
    host.changeInAnotherTab(PAUSE_KEY, undefined, PAUSE_STATE)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('lasts for this page load when localStorage is blocked: the host keeps it in memory and says so once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    swapWindowStorage('localStorage', blockedStorage)
    expect(isMascotPaused()).toBe(false)
    expect(setMascotPaused(true)).toEqual({ ok: true, persisted: false })
    expect(isMascotPaused()).toBe(true)
    setMascotPaused(false)
    expect(isMascotPaused()).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('is unknown while the host cannot say whose flag it is: a press is refused, logged once, and nothing is kept', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    host.setStorage({ ready: false })
    expect(setMascotPaused(true)).toMatchObject({ ok: false, reason: 'not-ready' })
    expect(setMascotPaused(false)).toMatchObject({ ok: false, reason: 'not-ready' })
    expect(mascotPause()).toBe('unknown')
    expect(isMascotPaused()).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('not-ready')
    expect(themeStateKeys(window.localStorage)).toEqual([])
  })
})
