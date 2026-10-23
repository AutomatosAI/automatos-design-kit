/**
 * PRD-261 B-02b: one value of the fake host that a test sets and a component reads. `use` reads it through
 * useSyncExternalStore, so every component reading it renders again when a test sets it (inside act), as a
 * component under the host's providers does when the host's state changes. Not an SDK name.
 */
import { useSyncExternalStore } from 'react'

export interface Cell<T> {
  /** The value now, for code outside a render. */
  readonly get: () => T
  /** A new value; every component reading it renders again. */
  readonly set: (next: T) => void
  /** The value, for a component: it renders again when the value changes. */
  readonly use: () => T
  /** Calls `listener` on every set until the returned function is called. */
  readonly subscribe: (listener: () => void) => () => void
}

export function cell<T>(initial: T): Cell<T> {
  let value = initial
  const listeners = new Set<() => void>()
  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
  const get = (): T => value
  return Object.freeze({
    get,
    set: (next: T) => {
      value = next
      Array.from(listeners).forEach((listener) => listener())
    },
    use: () => useSyncExternalStore(subscribe, get, get),
    subscribe,
  })
}

/** A list a fake appends to (what a theme asked of the host), read back by a test and emptied by the reset. */
export interface Log<T> {
  readonly add: (entry: T) => void
  readonly all: () => readonly T[]
  readonly clear: () => void
}

export function log<T>(): Log<T> {
  let entries: readonly T[] = Object.freeze([])
  return Object.freeze({
    add: (entry: T) => {
      entries = Object.freeze([...entries, entry])
    },
    all: () => entries,
    clear: () => {
      entries = Object.freeze([])
    },
  })
}

/** The TypeError every SDK area throws for a theme's bad input, in the SDK's words. */
export function refuse(reason: string): never {
  throw new TypeError(`Automatos theme SDK: ${reason}`)
}
