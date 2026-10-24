/**
 * The watch `automatos-theme dev` and `pack --watch` run on (PRD-261 B-02i): a theme folder's src/, with Node's own
 * fs.watch and nothing else.
 *
 * - Every folder under src/ gets its own watcher (one folder each, not fs.watch's recursive mode, which Node builds
 *   differently on each platform), and the set follows the tree: a folder added or removed is picked up at the next
 *   change. A symbolic link is never followed.
 * - Dotfiles and dot folders are left out, as pack leaves them out of source/: an editor's swap file is no change.
 * - A burst of changes is one change: the cycle runs once the folder has been quiet for DEBOUNCE_MS.
 * - Cycles never overlap. A change while one runs starts one more after it, never two.
 */
import { readdirSync, watch } from 'node:fs'
import { basename, join } from 'node:path'
import { isHidden } from './collect.ts'

/** How long src/ must be quiet before a burst of changes counts as one. */
export const DEBOUNCE_MS = 200

/** A watcher of one folder, that stops when closed. */
export interface Closable {
  readonly close: () => void
}

/** Watches one folder (not its sub-folders) and calls `listener` with the changed name, when the platform gives one. */
export type WatchOne = (dir: string, listener: (name: string | null) => void) => Closable

export interface WatchOptions {
  readonly debounceMs?: number
  /** One folder's watcher: Node's fs.watch unless a test gives another. */
  readonly watchOne?: WatchOne
}

export interface CycleOptions extends WatchOptions {
  /** What a cycle that threw is reported with; the watch goes on. */
  readonly onError: (error: unknown) => void
}

/** A running watch; `close` stops it and resolves once a cycle that is running has ended. */
export interface CycleWatch {
  readonly close: () => Promise<void>
}

/** fs.watch on one folder; a folder removed while watched closes its watcher instead of throwing. */
export const nodeWatchOne: WatchOne = (dir, listener) => {
  const watcher = watch(dir, { persistent: true }, (_event, name) => listener(name ?? null))
  watcher.on('error', () => watcher.close())
  return watcher
}

/** The folders right under `dir` but dot folders and links, by name; null when `dir` is gone. */
function subfolders(dir: string): string[] | null {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !isHidden(entry.name))
      .map((entry) => entry.name)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return null
    throw error
  }
}

/** `root` and every folder under it but dot folders, depth first; none when `root` is gone. */
export function foldersUnder(root: string): string[] {
  const names = subfolders(root)
  if (names === null) return []
  return [root, ...names.flatMap((name) => foldersUnder(join(root, name)))]
}

/** A watcher for `dir`, or null when the folder went away before it could be watched. */
function watchedFolder(watchOne: WatchOne, dir: string, listener: (name: string | null) => void): Closable | null {
  try {
    return watchOne(dir, listener)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

/** Calls `onChange` once per burst of changes under `root`, after `debounceMs` of quiet; returns the stop. */
export function watchTree(root: string, onChange: () => void, options: WatchOptions = {}): Closable {
  const debounceMs = options.debounceMs ?? DEBOUNCE_MS
  const watchOne = options.watchOne ?? nodeWatchOne
  const watchers = new Map<string, Closable>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let closed = false
  const changed = (name: string | null): void => {
    if (closed || (name !== null && isHidden(basename(name)))) return
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(fire, debounceMs)
  }
  const follow = (): void => {
    const now = new Set(foldersUnder(root))
    watchers.forEach((watcher, dir) => {
      if (now.has(dir)) return
      watcher.close()
      watchers.delete(dir)
    })
    now.forEach((dir) => {
      const watcher = watchers.has(dir) ? null : watchedFolder(watchOne, dir, changed)
      if (watcher !== null) watchers.set(dir, watcher)
    })
  }
  function fire(): void {
    timer = null
    if (closed) return
    follow()
    onChange()
  }
  follow()
  return {
    close: () => {
      closed = true
      if (timer !== null) clearTimeout(timer)
      watchers.forEach((watcher) => watcher.close())
      watchers.clear()
    },
  }
}

/** Runs `cycle` now, then once after each burst of changes under `root`, one cycle at a time. */
export function watchCycles(root: string, cycle: () => Promise<void>, options: CycleOptions): CycleWatch {
  let running: Promise<void> | null = null
  let again = false
  let closed = false
  const start = (): void => {
    if (closed) return
    if (running !== null) {
      again = true
      return
    }
    running = cycle().catch(options.onError).finally(() => {
      running = null
      if (!again) return
      again = false
      start()
    })
  }
  const tree = watchTree(root, start, options)
  start()
  return {
    close: async () => {
      closed = true
      tree.close()
      await running
    },
  }
}

/** Resolves on the first Ctrl-C (SIGINT) or SIGTERM, which then no longer end the process by themselves. */
export function untilStopped(): Promise<void> {
  return new Promise((resolve) => {
    const stop = (): void => {
      process.off('SIGINT', stop)
      process.off('SIGTERM', stop)
      resolve()
    }
    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)
  })
}
