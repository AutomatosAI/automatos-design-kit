/**
 * PRD-261 B-02b: the fake of SDK area `events`. It mirrors core's frontend/lib/theme-sdk/events.ts (at
 * 101a0bf33f64fb4f89af81b4293415be60b661ac) as it is: the host's signals are window events
 * ('automatos:board-changed', 'automatos:chat-changed'), a theme follows them by their short names, and
 * openGlobalSearch sends 'automatos:global-search-open' (lib/global-search-event.ts). A test sends a host
 * event with host.emitHostEvent and counts the searches a theme opened with host.globalSearchOpens().
 */
import type { HostEventHandler, HostEventName } from '@automatos/theme-sdk'
import { useEffect, useRef } from 'react'

type Sdk = typeof import('@automatos/theme-sdk')

/** events.ts:18. */
const WINDOW_EVENTS: Readonly<Record<HostEventName, string>> = Object.freeze({
  'board-changed': 'automatos:board-changed',
  'chat-changed': 'automatos:chat-changed',
})
/** lib/global-search-event.ts:6. */
const GLOBAL_SEARCH_OPEN_EVENT = 'automatos:global-search-open'

/** events.ts:24. */
export const HOST_EVENT_NAMES = Object.freeze(Object.keys(WINDOW_EVENTS) as HostEventName[]) satisfies Sdk['HOST_EVENT_NAMES']

let searchesOpened = 0

/** events.ts:26. */
function windowEventOf(name: unknown): string {
  if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(WINDOW_EVENTS, name)) {
    throw new TypeError(`Automatos theme SDK: there is no host event "${String(name)}".`)
  }
  return WINDOW_EVENTS[name as HostEventName]
}

/** events.ts:34: calls `handler` on every `name` event until the returned function is called. */
export const onHostEvent = ((name: HostEventName, handler: HostEventHandler): (() => void) => {
  const type = windowEventOf(name)
  if (typeof handler !== 'function') throw new TypeError('Automatos theme SDK: onHostEvent needs a handler function.')
  if (typeof window === 'undefined') return () => undefined
  const listener = (event: Event): void => handler(event instanceof CustomEvent ? event.detail : undefined)
  window.addEventListener(type, listener)
  return () => window.removeEventListener(type, listener)
}) satisfies Sdk['onHostEvent']

/** events.ts:44: onHostEvent for a component's lifetime; the latest handler is called, without resubscribing. */
export const useHostEvent = ((name: HostEventName, handler: HostEventHandler): void => {
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })
  useEffect(() => onHostEvent(name, (detail) => latest.current(detail)), [name])
}) satisfies Sdk['useHostEvent']

/** events.ts:53 over lib/global-search-event.ts:9: sends the open event, and counts it. */
export const openGlobalSearch = ((): void => {
  searchesOpened += 1
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(GLOBAL_SEARCH_OPEN_EVENT))
}) satisfies Sdk['openGlobalSearch']

/** The controls of this area, gathered by host.ts. */
export const eventControls = Object.freeze({
  /** The host sends `name` with `detail`, as its board stream does. */
  emitHostEvent(name: HostEventName, detail?: unknown): void {
    window.dispatchEvent(new CustomEvent(windowEventOf(name), { detail }))
  },
  /** How many times a theme opened the global search since the last reset. */
  globalSearchOpens(): number {
    return searchesOpened
  },
})

export function resetEvents(): void {
  searchesOpened = 0
}
