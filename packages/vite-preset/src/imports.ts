/**
 * Which bare imports a theme's bundle leaves to the host, and which it may not make at all.
 *
 * A theme runs inside the host page, which serves one instance of each shared module through its
 * import map (core's frontend/lib/theme-host/shared-modules.json): React, its JSX runtime,
 * react-dom, react-dom/client and the theme SDK. The bundle keeps exactly those specifiers as
 * imports. Anything else under react, react-dom or the SDK would be a second copy the host can't
 * share, so it is refused, as is `sonner`: the import map has no entry for it, and a theme's
 * toasts go through the SDK's notices. A stylesheet imported as a string or a URL
 * (`?inline`, `?raw`, `?url`) would skip the scope check, so that is refused too.
 */

/** The import map's specifiers, in its order (shared-modules.json `modules[].specifier`). */
export const SHARED_MODULES: readonly string[] = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@automatos/theme-sdk',
]

const SHARED: ReadonlySet<string> = new Set(SHARED_MODULES)
const SHARED_ROOTS: readonly string[] = ['react', 'react-dom', '@automatos/theme-sdk']
const REFUSED_PACKAGES: ReadonlyMap<string, string> = new Map([
  ['sonner', "the host's import map has no sonner: show toasts through the SDK's notices instead."],
])
const STYLE_AS_TEXT = /\.(?:css|scss|sass|less|styl|stylus|pcss|postcss|sss)\?(?:[^#]*&)?(?:inline|raw|url)(?:[&=#]|$)/

/** True when the bundle leaves `source` to the host's import map. */
export function isSharedModule(source: string): boolean {
  return SHARED.has(source)
}

/** The package a bare specifier names: `@scope/name` or `name`. */
function packageName(source: string): string {
  const parts = source.split('/')
  return source.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

/** Why a theme may not import `source`, or null when it may. */
export function importRefusal(source: string): string | null {
  if (isSharedModule(source)) return null
  if (STYLE_AS_TEXT.test(source)) {
    return `"${source}" imports a stylesheet as text or a URL, which would skip the CSS scope check: import it plainly.`
  }
  const name = packageName(source)
  const refused = REFUSED_PACKAGES.get(name)
  if (refused !== undefined) return `A theme may not import "${source}": ${refused}`
  if (SHARED_ROOTS.includes(name)) {
    return `A theme may not import "${source}": the host shares only ${SHARED_MODULES.join(', ')}.`
  }
  return null
}
