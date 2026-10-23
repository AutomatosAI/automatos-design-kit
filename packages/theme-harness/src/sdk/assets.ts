/**
 * PRD-261 B-02b: the fake of SDK area `assets`. It mirrors core's frontend/lib/theme-sdk/assets.ts:57 (at
 * 101a0bf33f64fb4f89af81b4293415be60b661ac): a path is checked as core's resolveUnderRoot checks it
 * (lib/theme-host/manifest.ts:98: plain, relative, lowercase, no '..' and no '//'), and the answer is null
 * while the host names no package. The package's files folder is the one a test set (host.setFilesRoot; core
 * reads it from the style and digest cookies), and the URL is that folder and the path, also in a test that
 * runs in node, where core (on the server) answers null. Every path asked for is kept (host.askedPaths()).
 */
type Sdk = typeof import('@automatos/theme-sdk')

/** manifest.ts:67. */
const RELATIVE_PATH = /^[a-z0-9][a-z0-9._/-]*$/
const PARENT = '..'

let filesRoot: string | null = null
let asked: readonly string[] = Object.freeze([])

const isPackagePath = (path: unknown): path is string =>
  typeof path === 'string' && RELATIVE_PATH.test(path) && !path.includes('//') && !path.split('/').includes(PARENT)

/** assets.ts:57: the URL of `path` in the active theme's package, or null. */
export const assetUrl = ((path: string): string | null => {
  asked = Object.freeze([...asked, path])
  return filesRoot !== null && isPackagePath(path) ? `${filesRoot}${path}` : null
}) satisfies Sdk['assetUrl']

/** The controls of this area, gathered by host.ts. */
export const assetControls = Object.freeze({
  /** The folder assetUrl puts in front of a path; null makes it answer null, as the host does when it knows no package. */
  setFilesRoot(root: string | null): void {
    filesRoot = root
    asked = Object.freeze([])
  },
  /** Every path assetUrl was asked for since the last setFilesRoot or reset, oldest first. */
  askedPaths(): readonly string[] {
    return asked
  },
})

export function resetAssets(): void {
  assetControls.setFilesRoot(null)
}
