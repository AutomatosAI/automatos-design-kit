// A window of a chosen width for the phone layout's tests. jsdom has no matchMedia, so HUD reads every window in a
// test as a wide one (src/lib/phone-layout.ts). setWindowWidth installs a matchMedia that answers the max-width and
// min-width queries by the width set here, and no other query (the reduced-motion one the harness asks among them),
// and tells a list's listeners when a new width flips it, as a browser does when the window crosses a width: wrap a
// change after the first render in act(). resetWindowWidth takes it away again, so jsdom has no matchMedia once more.
type Listener = (event: { readonly matches: boolean; readonly media: string }) => void

interface FakeList {
  readonly media: string
  readonly listeners: Set<Listener>
  last: boolean
}

/** A desktop window, as jsdom's own reads. */
export const DESKTOP_WIDTH = 1280
/** The Command design's phone. */
export const PHONE_WIDTH = 390

const MAX_WIDTH = /\(max-width:\s*(\d+(?:\.\d+)?)px\)/
const MIN_WIDTH = /\(min-width:\s*(\d+(?:\.\d+)?)px\)/

let width = DESKTOP_WIDTH
const lists = new Map<string, FakeList>()

function matchesAt(media: string, at: number): boolean {
  const max = MAX_WIDTH.exec(media)
  if (max !== null) return at <= Number(max[1])
  const min = MIN_WIDTH.exec(media)
  return min !== null && at >= Number(min[1])
}

function listOf(media: string): FakeList {
  const known = lists.get(media)
  if (known !== undefined) return known
  const made: FakeList = { media, listeners: new Set(), last: matchesAt(media, width) }
  lists.set(media, made)
  return made
}

function matchMedia(media: string): MediaQueryList {
  const list = listOf(media)
  const add = (_type: string, listener: Listener): void => void list.listeners.add(listener)
  const remove = (_type: string, listener: Listener): void => void list.listeners.delete(listener)
  return {
    media,
    get matches() {
      return matchesAt(media, width)
    },
    onchange: null,
    addEventListener: add,
    removeEventListener: remove,
    addListener: (listener: Listener) => add('change', listener),
    removeListener: (listener: Listener) => remove('change', listener),
    dispatchEvent: () => true,
  } as unknown as MediaQueryList
}

/** The window is `next` pixels wide from now on; every list the new width flips tells its listeners. */
export function setWindowWidth(next: number): void {
  width = next
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: matchMedia })
  lists.forEach((list) => {
    const now = matchesAt(list.media, width)
    if (now === list.last) return
    list.last = now
    list.listeners.forEach((listener) => listener({ matches: now, media: list.media }))
  })
}

/** jsdom's window again: no matchMedia, read as a wide window. */
export function resetWindowWidth(): void {
  Reflect.deleteProperty(window, 'matchMedia')
  lists.clear()
  width = DESKTOP_WIDTH
}
