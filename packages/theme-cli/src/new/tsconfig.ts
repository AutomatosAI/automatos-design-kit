/**
 * A theme `new` writes builds wherever it is written. A theme in the kit (themes/play, themes/hud, the templates)
 * extends the kit's shared compiler options with `"extends": "../../tsconfig.base.json"`, a path that holds only two
 * folders under the kit's root.
 *
 * - In the kit's own themes/ (the default `--to` when the command runs at the kit's root), the theme keeps that
 *   tsconfig.json as its template has it (minimal's own, full's copied from Play), as Play's and HUD's do: the kit's
 *   CI holds every workspace to extending the base.
 * - Anywhere else (another repository, a temp folder), the base is not two folders up, and Vite reads the
 *   tsconfig.json and refuses one whose base is missing. So the written tsconfig.json holds tsconfig.base.json's
 *   compilerOptions itself, read from the kit the command runs from, with the template's own fields (its include
 *   list) as they are; an option the template sets wins over the base's.
 */
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/** The kit's shared compiler options, at its root. */
export const BASE_TSCONFIG = 'tsconfig.base.json'
const THEME_TSCONFIG = 'tsconfig.json'
const JSON_INDENT = 2

type TsConfig = Readonly<Record<string, unknown>>

function compilerOptionsOf(config: TsConfig): Readonly<Record<string, unknown>> {
  const options = config.compilerOptions
  return typeof options === 'object' && options !== null && !Array.isArray(options) ? (options as Record<string, unknown>) : {}
}

/** `theme` with the base's compilerOptions in place of its `extends`, the theme's own options winning. */
export function standaloneTsconfig(theme: TsConfig, base: TsConfig): TsConfig {
  const fields = Object.entries(theme).filter(([key]) => key !== 'extends' && key !== 'compilerOptions')
  return { compilerOptions: { ...compilerOptionsOf(base), ...compilerOptionsOf(theme) }, ...Object.fromEntries(fields) }
}

/** Rewrites the tsconfig.json `new` wrote at `target` to hold the kit's base options from `kitRoot` itself. */
export function writeStandaloneTsconfig(target: string, kitRoot: string): void {
  const path = join(target, THEME_TSCONFIG)
  if (!existsSync(path)) return
  const theme = JSON.parse(readFileSync(path, 'utf8')) as TsConfig
  const base = JSON.parse(readFileSync(join(kitRoot, BASE_TSCONFIG), 'utf8')) as TsConfig
  writeFileSync(path, `${JSON.stringify(standaloneTsconfig(theme, base), null, JSON_INDENT)}\n`)
}

function realOrSelf(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

/** Whether `target` is a folder right inside `themesFolder` (the kit's themes/), where the base is two folders up. */
export function isKitTheme(target: string, themesFolder: string): boolean {
  return realOrSelf(dirname(resolve(target))) === realOrSelf(resolve(themesFolder))
}

/**
 * The tsconfig.json of the theme `new` wrote at `target`: left extending the base, as its template wrote it, when
 * `target` is in the kit's `themesFolder`; made to stand alone, with the base's options from `kitRoot`, anywhere else.
 */
export function writeThemeTsconfig(target: string, kitRoot: string, themesFolder: string): void {
  if (!isKitTheme(target, themesFolder)) writeStandaloneTsconfig(target, kitRoot)
}
