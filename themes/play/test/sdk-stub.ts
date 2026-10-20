// Stands in for the host's @automatos/theme-sdk in Play's tests (vitest.config.ts points the module
// name here): the host serves the real one through its import map, and the kit vendors its types only.
// It holds only what the tested modules call. A test sets the files folder assetUrl answers from, and
// the storage area's scope through test/storage-port.ts (core's storage area, ported).
export { readThemeState, removeThemeState, subscribeThemeState, THEME_STATE_LIMITS, writeThemeState } from './storage-port.ts'

let filesRoot: string | null = null
let asked: readonly string[] = []

/** The folder assetUrl puts in front of a path; null makes it answer null, as the host does when it knows no package. */
export function setFilesRoot(root: string | null): void {
  filesRoot = root
  asked = []
}

/** Every path assetUrl was asked for since the last setFilesRoot. */
export function askedPaths(): readonly string[] {
  return asked
}

export function assetUrl(path: string): string | null {
  asked = [...asked, path]
  return filesRoot === null ? null : `${filesRoot}${path}`
}
