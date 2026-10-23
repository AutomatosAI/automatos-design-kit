// PRD-261 B-05e: the look runtime host.setLooks mounts can start on a look other than the theme's default one, as
// core's does when it reads back a user's saved look on a reload: deleting the active look then goes back to the
// default look (defaultLook), and without one to the look it was mounted on. A deleted look that isn't active
// leaves the active look alone. Read through the SDK's useLook and listLooks, as a theme reads them.
import { listLooks, useLook, type HostLookState } from '@automatos/theme-sdk'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '../src/host.ts'

const DEFAULT = Object.freeze({ schema: 'example-look/v1', id: 'calm', name: 'Calm', sub: 'Soft and quiet' })
const MINE = Object.freeze({ schema: 'example-look/v1', id: 'mine-1', name: 'Mine', sub: 'Saved just now' })
const OTHER = Object.freeze({ schema: 'example-look/v1', id: 'mine-2', name: 'Other', sub: 'Saved before' })

/** The look runtime's state as the last render read it. */
function mountProbe(): () => HostLookState {
  let latest: HostLookState | null = null
  function Probe() {
    latest = useLook()
    return null
  }
  render(<Probe />)
  return () => {
    if (latest === null) throw new Error('the probe never rendered')
    return latest
  }
}

beforeEach(() => {
  host.reset()
})

describe("the look runtime's default look", () => {
  it('is defaultLook when given: a runtime started on a saved look deletes it back to the default', () => {
    host.setLooks({ look: MINE, saved: [MINE, OTHER], defaultLook: DEFAULT })
    const state = mountProbe()
    expect(state().look).toEqual(MINE)
    act(() => state().deleteLook(OTHER.id))
    expect([state().look, listLooks()]).toEqual([MINE, [MINE]])
    act(() => state().deleteLook(MINE.id))
    expect([state().look, listLooks()]).toEqual([DEFAULT, []])
  })

  it('is the look it was mounted on when no defaultLook is given', () => {
    host.setLooks({ look: DEFAULT, saved: [MINE] })
    const state = mountProbe()
    act(() => {
      state().setLook(MINE)
    })
    expect(state().look).toEqual(MINE)
    act(() => state().deleteLook(MINE.id))
    expect([state().look, listLooks()]).toEqual([DEFAULT, []])
  })
})
