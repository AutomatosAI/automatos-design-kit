/**
 * PRD-261 B-02b (plan §2.2.9): inside the harness the global `fetch` and `XMLHttpRequest` throw. A theme
 * reaches the backend only through the SDK, which the harness fakes, so a test that reaches the network is
 * a theme calling something it must not (or a fake that does): the call throws a TypeError naming it, and
 * is kept, so a test can also assert that nothing tried (host.networkCalls()). src/no-network.ts installs
 * the refusals before every test file; the host's reset forgets the calls.
 */
import { log } from './cell.ts'

/** One refused call: which API, and what it was asked for. */
export interface NetworkCall {
  readonly api: 'fetch' | 'XMLHttpRequest'
  readonly target: string
}

const calls = log<NetworkCall>()
const NO_TARGET = '(no URL yet)'

function targetOf(input: unknown): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  const url = (input as { readonly url?: unknown } | null)?.url
  return typeof url === 'string' ? url : String(input)
}

function refused(api: NetworkCall['api'], target: string): never {
  calls.add(Object.freeze({ api, target }))
  throw new TypeError(
    `@automatos/theme-harness: ${api} is refused in a theme's tests (${target}); the theme reaches the host through the SDK only.`,
  )
}

/** The fetch a test gets: it throws, and the call is kept. */
function refusedFetch(input: unknown): never {
  return refused('fetch', targetOf(input))
}

/** The XMLHttpRequest a test gets: constructing one throws, and the attempt is kept. */
class RefusedXMLHttpRequest {
  constructor() {
    refused('XMLHttpRequest', NO_TARGET)
  }
}

function install(target: object, name: string, value: unknown): void {
  Object.defineProperty(target, name, { configurable: true, writable: true, value })
}

/** Puts the refusals on the global object (and on jsdom's window, when it is another object). */
export function refuseNetwork(): void {
  const targets = typeof window !== 'undefined' && window !== globalThis ? [globalThis, window] : [globalThis]
  targets.forEach((target) => {
    install(target, 'fetch', refusedFetch)
    install(target, 'XMLHttpRequest', RefusedXMLHttpRequest)
  })
}

/** Every refused call since the last reset, oldest first. */
export function networkCalls(): readonly NetworkCall[] {
  return calls.all()
}

export function forgetNetworkCalls(): void {
  calls.clear()
}
