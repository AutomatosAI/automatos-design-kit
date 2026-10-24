/**
 * The source guard's check on the build's output: what was bundled, emitted and inlined, whatever
 * the source text that asked for it looked like.
 *
 * In library mode Vite inlines every asset a stylesheet's url() or a script's
 * `new URL('…', import.meta.url)` names, whatever build.assetsInlineLimit says (vite 8.3.4,
 * shouldInline: `if (environment.config.build.lib) return true` comes before the limit is read), and
 * it reads those files straight from disk, without a `load`. Setting the limit to 0 would change
 * nothing, so this check reads the inlined data: URLs instead: each must hold the bytes of a file
 * under src/ (as Vite encodes them) or be written out in a file under src/.
 * It also refuses a chunk listing a module from outside src/ or importing at run time anything but
 * the host's shared modules or its own chunks, and an emitted asset (other than a stylesheet, which
 * Vite builds from the CSS modules `load` has checked) whose original files are not under src/.
 */
import { readdirSync, readFileSync, type Dirent } from 'node:fs'
import { join, resolve } from 'node:path'
import { isSharedModule } from './imports.ts'
import { isInsideSource, moduleProblem, SOURCE_DIR, type SourceTree } from './source-tree.ts'

/** A data: URL's header, after a quote, bracket, comma or space, where Vite or an author puts one. */
const DATA_URL = /(?<=^|[\s"'`(,])data:(?:[a-z]+\/[a-z0-9.+-]+)?((?:;[a-z0-9=.+-]+)*),/gi
const BASE64_PARAM = /;base64$/i
/** A payload runs as far as it can: base64 to its last base64 character, any other to a quote, backtick or space. */
const BASE64_RUN = /^[A-Za-z0-9+/=]*/
const PLAIN_RUN = /^[^\s"`]*/
/** Where an author's plain payload may end in the output once the build has requoted it. */
const LITERAL_ENDS: readonly string[] = ["'", ')']
/** Vite writes an SVG as base64 when it holds one of these (svgToDataURL in vite 8.3.4). */
const SVG_NEEDS_BASE64 = /<text|<foreignObject|"[^"']*'[^"]*"|'[^'"]*"[^']*'/
const SVG_FILE = /\.svg$/
const STYLE_ASSET = /\.css$/
const PREVIEW_LENGTH = 40

interface Payload {
  readonly base64: boolean
  readonly text: string
}

/** The data: URL payloads a build may inline: the files under src/ and the data: URLs written in them. */
export interface Inlinable {
  readonly base64: ReadonlySet<string>
  readonly plain: ReadonlySet<string>
}

/** Every data: URL payload in `text`, each taken as far as it runs. */
export function dataPayloads(text: string): Payload[] {
  return Array.from(text.matchAll(DATA_URL), (match) => {
    const base64 = BASE64_PARAM.test(match[1] ?? '')
    const rest = text.slice((match.index ?? 0) + match[0].length)
    return { base64, text: (base64 ? BASE64_RUN : PLAIN_RUN).exec(rest)?.[0] ?? '' }
  })
}

/** Vite's text form of an SVG data: URL payload (svgToDataURL in vite 8.3.4), or null where it uses base64. */
export function svgPayload(content: Uint8Array): string | null {
  const text = Buffer.from(content).toString()
  if (SVG_NEEDS_BASE64.test(text)) return null
  return text.trim()
    .replaceAll(/>\s+</g, '><')
    .replaceAll('"', "'")
    .replaceAll('%', '%25')
    .replaceAll('#', '%23')
    .replaceAll('<', '%3c')
    .replaceAll('>', '%3e')
    .replaceAll(/\s+/g, '%20')
}

function entriesOf(dir: string): Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
}

/** Every regular file under `dir` (symlinks are left out, so what they point at is never allowed). */
function sourceFiles(dir: string): string[] {
  return entriesOf(dir).flatMap((dirent): string[] => {
    const path = join(dir, dirent.name)
    if (dirent.isDirectory()) return sourceFiles(path)
    return dirent.isFile() ? [path] : []
  })
}

/** An author's plain payload as written, and as it reads once the build has requoted it. */
function literalForms(text: string): string[] {
  return [text, ...LITERAL_ENDS.map((end) => text.split(end)[0] ?? '')]
}

/** The payloads the theme at `tree` may inline: its src/ files and its bundled packages' (tree.sources). */
export function inlinableData(tree: SourceTree): Inlinable {
  const files = tree.sources.flatMap(sourceFiles).map((file) => ({ file, bytes: readFileSync(file) }))
  const literals = files.flatMap(({ bytes }) => dataPayloads(bytes.toString()))
  const base64 = [
    ...files.map(({ bytes }) => bytes.toString('base64')),
    ...literals.filter((payload) => payload.base64).map((payload) => payload.text),
  ]
  const plain = [
    ...files.filter(({ file }) => SVG_FILE.test(file)).flatMap(({ bytes }) => svgPayload(bytes) ?? []),
    ...literals.filter((payload) => !payload.base64).flatMap((payload) => literalForms(payload.text)),
  ]
  return { base64: new Set(base64), plain: new Set(plain) }
}

/** Every data: URL in the output file `name` that holds something other than a file under src/. */
export function inlinedDataProblems(text: string, name: string, inlinable: () => Inlinable): string[] {
  return dataPayloads(text).flatMap((payload) => {
    if (payload.text === '') return []
    const known = payload.base64 ? inlinable().base64 : inlinable().plain
    if (known.has(payload.text)) return []
    const preview = payload.text.slice(0, PREVIEW_LENGTH)
    return [
      `${name} inlines a data: URL (${preview}…) that is not the content of a file under the theme's ${SOURCE_DIR}/: `
      + `the build read it from outside ${SOURCE_DIR}/. Refer only to files under ${SOURCE_DIR}/.`,
    ]
  })
}

interface ChunkLike {
  readonly type: 'chunk'
  readonly moduleIds: readonly string[]
  readonly imports: readonly string[]
  readonly dynamicImports: readonly string[]
  readonly code?: string
}

interface AssetLike {
  readonly type: 'asset'
  readonly originalFileNames?: readonly string[]
  readonly source?: string | Uint8Array
}

type Bundle = Readonly<Record<string, { readonly type: string }>>

/** Modules from outside src/, run-time imports the host can't serve, and data: URLs from outside src/. */
function chunkProblems(name: string, chunk: ChunkLike, bundle: Bundle, tree: SourceTree, inlinable: () => Inlinable): string[] {
  return [
    ...chunk.moduleIds.flatMap((id) => moduleProblem(id, tree) ?? []),
    ...[...chunk.imports, ...chunk.dynamicImports].flatMap((target) => (
      target in bundle || isSharedModule(target)
        ? []
        : [`The build imports "${target}" at run time, which is not one of the host's shared modules.`]
    )),
    ...inlinedDataProblems(chunk.code ?? '', name, inlinable),
  ]
}

/** An emitted asset made from a file outside src/ (Rolldown's originalFileNames: Vite gives them relative to the root). */
function assetOriginProblems(name: string, asset: AssetLike, tree: SourceTree): string[] {
  if (STYLE_ASSET.test(name)) return []
  const origins = asset.originalFileNames ?? []
  if (origins.length === 0) return [`The build emits ${name}, which was not made from a file under the theme's ${SOURCE_DIR}/.`]
  return origins.flatMap((origin) => (
    isInsideSource(resolve(tree.root, origin), tree)
      ? []
      : [`The build emits ${name} from ${origin}, which is outside the theme's ${SOURCE_DIR}/.`]
  ))
}

function assetText(name: string, asset: AssetLike): string {
  if (typeof asset.source === 'string') return asset.source
  return asset.source !== undefined && STYLE_ASSET.test(name) ? Buffer.from(asset.source).toString() : ''
}

/** Every problem in the output: what was bundled, emitted and inlined from outside src/. */
export function bundleProblems(bundle: Bundle, tree: SourceTree): string[] {
  let inlinable: Inlinable | null = null
  const lazyInlinable = (): Inlinable => (inlinable ??= inlinableData(tree))
  return Object.entries(bundle).flatMap(([name, item]) => {
    if (item.type === 'chunk') return chunkProblems(name, item as ChunkLike, bundle, tree, lazyInlinable)
    if (item.type !== 'asset') return []
    const asset = item as AssetLike
    return [...assetOriginProblems(name, asset, tree), ...inlinedDataProblems(assetText(name, asset), name, lazyInlinable)]
  })
}
