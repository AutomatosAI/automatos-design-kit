/**
 * `new --template full --mascot none` (PRD-261 B-03f): the full template with no mascot. Applied to Play's files and
 * the template's code, before the patches and the renames, so every path and name here is Play's.
 *
 * - The clips and stills (`assets/mascot/`) and the clips' notice are left out, with theme.json's `mascot` block and
 *   the `mobile` block's `mascot`, and the `@automatos/mascot` dependency.
 * - The code that draws Auto is replaced by the template's own (templates/full/no-mascot): his caption with no clip,
 *   still, ring or Pause control, and no mascot section in the style sheet.
 * - The chat still says what Auto is doing (its captions, its tool lines, its turn's end), from the package's state
 *   machine and words. So those modules are copied from the kit's packages/mascot/src into the theme's own src/, and
 *   each import of `@automatos/mascot/<module>` points there instead. An import of a module that is not copied stops
 *   the copy, with a sentence: the theme would no longer build.
 */
import { readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import type { NoMascot } from './full-spec.ts'
import { isTextFile, readFolder, type FolderFile } from './placeholders.ts'

export type Files = ReadonlyMap<string, FolderFile>

const SOURCE_PREFIX = 'src/'
const MODULE_SUFFIX = '.ts'
const MASCOT_IMPORT = /(['"])@automatos\/mascot\/([a-z][a-z0-9-]*)\1/g
/** "@automatos/mascot's ring.ts" in a comment: the package the theme no longer names. */
const MASCOT_MENTION = /@automatos\/mascot(?=['’]s\b)/g

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function underAny(path: string, roots: readonly string[]): boolean {
  return roots.some((root) => path === root || path.startsWith(`${root}/`))
}

/** The relative specifier from the file at `from` to the module at `to` (both package paths, no extension). */
export function relativeSpecifier(from: string, to: string): string {
  const relative = posix.relative(posix.dirname(from), to)
  return relative.startsWith('.') ? relative : `./${relative}`
}

/** `file`'s imports of the package's modules pointed at the copies under `vendorDir`; one it doesn't copy throws. */
function pointedAtCopies(file: FolderFile, spec: NoMascot): FolderFile {
  const text = decoder.decode(file.data)
  const repointed = text.replace(MASCOT_IMPORT, (_whole, quote: string, module: string) => {
    if (!spec.vendor.modules.includes(module)) {
      throw new Error(`${file.path} imports ${spec.package}/${module}, which --mascot none does not copy into the theme.`)
    }
    return `${quote}${relativeSpecifier(file.path, posix.join(spec.vendor.to, module))}${quote}`
  })
  const said = repointed.replace(MASCOT_MENTION, spec.vendor.to.slice(SOURCE_PREFIX.length))
  return said === text ? file : { path: file.path, data: encoder.encode(said) }
}

/** The package's modules the theme keeps, read from the kit, at their place in the theme's src/. */
function copiedModules(kitRoot: string, spec: NoMascot): FolderFile[] {
  return spec.vendor.modules.map((module) => ({
    path: posix.join(spec.vendor.to, `${module}${MODULE_SUFFIX}`),
    data: new Uint8Array(readFileSync(join(kitRoot, spec.vendor.from, `${module}${MODULE_SUFFIX}`))),
  }))
}

/** Play's files with no mascot: the drops, the template's no-mascot code, the copied modules, the imports repointed. */
export function withoutMascot(files: Files, spec: NoMascot, kitRoot: string, templateDir: string): Map<string, FolderFile> {
  const kept = Array.from(files.values()).filter((file) => !underAny(file.path, spec.drop))
  const added = [...copiedModules(kitRoot, spec), ...readFolder(join(templateDir, spec.code))]
  const merged = new Map([...kept, ...added].map((file): [string, FolderFile] => [file.path, file]))
  return new Map(Array.from(merged, ([path, file]): [string, FolderFile] => (
    [path, path.startsWith(SOURCE_PREFIX) && isTextFile(path) ? pointedAtCopies(file, spec) : file]
  )))
}

/** theme.json with no mascot: no `mascot` block, and a `mobile` block that draws none. */
export function manifestWithoutMascot(manifest: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const { mascot: _mascot, mobile, ...rest } = manifest
  if (typeof mobile !== 'object' || mobile === null) return rest
  const { mascot: _mobileMascot, ...phone } = mobile as Readonly<Record<string, unknown>>
  return { ...rest, mobile: phone }
}
