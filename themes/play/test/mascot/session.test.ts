// PRD-260 D6: hello plays once per browser session. Moved from core's lib/mascot/__tests__/session.test.ts
// and rewritten for E3g (PB-9, PB-10): the session remembers it through the host, in the SDK's storage area
// (key hello-played, for this tab's session, for the account), where the browser blocks its storage the
// host keeps it for the page, so hello plays once per page load, and until the host can say whose session
// it is nothing is claimed. Run on the harness's storage area (packages/theme-harness); a new tab's session and
// blocked storage are core's memoryStorage and blockedStorage (test/support/memory-storage.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { claimFirstOpen, HELLO_KEY, HELLO_STATE, helloReady, subscribeHello } from '../../src/lib/mascot/session.ts'
import { readThemeState, THEME_STATE_LIMITS, writeThemeState } from '@automatos/theme-sdk'
import { host } from '@automatos/theme-harness/host'
import {
  blobData, blockedStorage, memoryStorage, SESSION_ACCOUNT, swapWindowStorage, themeStateKeys,
} from '../support/memory-storage.ts'

/** Where hello's first open lived before the move to the host (PRD-261 E1): never read again. */
const OLD_HELLO_KEY = 'automatos-play.hello-played'

beforeEach(() => {
  host.reset()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.sessionStorage.removeItem(OLD_HELLO_KEY)
})

describe('claimFirstOpen', () => {
  it("says yes once per session, and remembers it in the session's storage", () => {
    window.sessionStorage.setItem(OLD_HELLO_KEY, '1')
    expect(claimFirstOpen()).toBe(true)
    expect(blobData(window.sessionStorage, SESSION_ACCOUNT)).toEqual({ [HELLO_KEY]: true })
    expect(themeStateKeys(window.localStorage)).toEqual([])
    expect(claimFirstOpen()).toBe(false)
    const nextSession = memoryStorage()
    swapWindowStorage('sessionStorage', () => nextSession)
    expect(claimFirstOpen()).toBe(true)
    expect(claimFirstOpen()).toBe(false)
    expect(themeStateKeys(nextSession)).toEqual([SESSION_ACCOUNT])
  })

  it('says yes once per page load where storage is blocked, with the one warning the host gives', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    swapWindowStorage('sessionStorage', blockedStorage)
    expect(claimFirstOpen()).toBe(true)
    expect(claimFirstOpen()).toBe(false)
    expect(readThemeState(HELLO_KEY, HELLO_STATE)).toMatchObject({ ready: true, value: true, persisted: false })
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('says no until the host can say whose session it is, and tells its caller when it can', () => {
    host.setStorage({ ready: false })
    expect([helloReady(), claimFirstOpen(), claimFirstOpen()]).toEqual([false, false, false])
    const onChange = vi.fn()
    const stop = subscribeHello(onChange)
    host.setStorage({ ready: true })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect([helloReady(), claimFirstOpen(), claimFirstOpen()]).toEqual([true, true, false])
    stop()
  })

  it('says yes once per page load when the host refuses to keep it, and logs why each time', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    for (let index = 0; index < THEME_STATE_LIMITS.keysPerBlob; index += 1) {
      writeThemeState(`other-${index}`, true, HELLO_STATE)
    }
    expect([claimFirstOpen(), claimFirstOpen()]).toEqual([true, false])
    expect(readThemeState(HELLO_KEY, HELLO_STATE).value).toBeNull()
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('too-large'), expect.any(String))
  })
})
