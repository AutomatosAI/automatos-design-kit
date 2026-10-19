/**
 * @automatos/vite-preset — builds an Automatos theme the way the host loads it.
 *
 * `vite.config.ts` in a theme folder: `export default defineConfig({ plugins: [automatosTheme()] })`.
 * The build is an ES library: `dist/entry.js` (plus `dist/chunks/*.js` for lazy imports) with the
 * import map's modules left as imports, and one stylesheet, `dist/theme.css`, wrapped under the
 * theme's class and checked as the server checks it. `htmlClass` comes from the theme's
 * `theme.json` unless given. Only files under the theme's `src/` go into the build (source-guard.ts,
 * css-origin.ts and output-check.ts).
 * Then `automatos-theme pack` (packages/theme-cli) zips the package.
 */
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Plugin, UserConfig } from 'vite'
import { cssScopeErrors, STYLE_PATH, type ThemeError } from './css-scope.ts'
import { importRefusal, isSharedModule } from './imports.ts'
import { cssOriginGuard } from './css-origin.ts'
import { sourceGuard, sourceTree } from './source-guard.ts'
import { checkedOptions, transformThemeCss, type WrapForm } from './theme-css.ts'

export { cssScopeErrors, CSS_ERROR_CODES, STYLE_PATH, type ThemeError } from './css-scope.ts'
export { importRefusal, isSharedModule, SHARED_MODULES } from './imports.ts'
export { cssOriginGuard } from './css-origin.ts'
export { bundleProblems } from './output-check.ts'
export { isInsideSource, moduleProblem, referenceProblem, sourceGuard, sourceTree, SOURCE_DIR, type SourceTree } from './source-guard.ts'
export { themeCssPlugin, transformThemeCss, wrapSelector, type ThemeCssOptions, type WrapForm } from './theme-css.ts'

export interface ThemePresetOptions {
  /** The theme's class on <html>; read from theme.json in the project root when left out. */
  readonly htmlClass?: string
  /** The entry module, relative to the project root and under its `src/`. Default `src/entry.ts`. */
  readonly entry?: string
  /** 'html' (default): rules under html.<htmlClass>. 'where': under :where(html.<htmlClass>). */
  readonly wrap?: WrapForm
  /** Minify dist/theme.css (Vite's own CSS minifier). Default false: the scope check reads the output either way. */
  readonly cssMinify?: boolean
}

interface Settings {
  readonly htmlClass: string
  readonly wrap: WrapForm
}

export const DEFAULT_ENTRY = 'src/entry.ts'
export const OUT_DIR = 'dist'
const ENTRY_FILE = 'entry.js'
const STYLE_FILE = STYLE_PATH.slice(`${OUT_DIR}/`.length)
const STYLE_NAME = STYLE_FILE.replace(/\.css$/, '')
const CHUNK_FILES = 'chunks/c-[hash].js'
const MANIFEST_FILE = 'theme.json'
const TARGET = 'es2020'

/** The theme's htmlClass from its theme.json, for a preset given none. */
function htmlClassFromManifest(root: string): string {
  const path = resolve(root, MANIFEST_FILE)
  let manifest: unknown
  try {
    manifest = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`automatosTheme(): no htmlClass given and ${path} can't be read as JSON (${String(error)}).`)
  }
  const htmlClass = (manifest as { htmlClass?: unknown } | null)?.htmlClass
  if (typeof htmlClass !== 'string') throw new Error(`automatosTheme(): ${path} has no "htmlClass".`)
  return htmlClass
}

/** The build settings for a project root. */
function settingsFor(options: ThemePresetOptions, root: string): Settings {
  const htmlClass = options.htmlClass ?? htmlClassFromManifest(root)
  return checkedOptions({ htmlClass, wrap: options.wrap })
}

/** The Vite config the preset sets: an ES library with the shared modules external. */
export function presetConfig(options: ThemePresetOptions, root: string, htmlClass: string): UserConfig {
  return {
    publicDir: false,
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    oxc: { jsx: { runtime: 'automatic', importSource: 'react', development: false } },
    css: {
      transformer: 'postcss',
      // Given here, so Vite reads no postcss.config.* from beside src/ (the review rebuilds without one).
      postcss: { plugins: [cssOriginGuard(sourceTree(root))] },
      modules: { generateScopedName: `${htmlClass}-[local]-[hash:base64:5]` },
    },
    build: {
      outDir: OUT_DIR,
      emptyOutDir: true,
      copyPublicDir: false,
      sourcemap: false,
      target: TARGET,
      cssCodeSplit: false,
      cssMinify: options.cssMinify ?? false,
      lib: {
        entry: resolve(root, options.entry ?? DEFAULT_ENTRY),
        formats: ['es'],
        fileName: () => ENTRY_FILE,
        cssFileName: STYLE_NAME,
      },
      rolldownOptions: {
        external: (source: string) => isSharedModule(source),
        output: { chunkFileNames: CHUNK_FILES },
      },
    },
  }
}

/** Every refusal on one line each, for a build error. */
function errorReport(errors: readonly ThemeError[]): string {
  const lines = errors.map((error) => `  ${error.code} ${error.path}: ${error.message}`)
  return [`${STYLE_PATH} would be refused by the Automatos server:`, ...lines].join('\n')
}

/** Every .css file under `dir`, as paths relative to it. */
function styleFiles(dir: string, prefix = ''): string[] {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((dirent): string[] => {
    const path = prefix ? `${prefix}/${dirent.name}` : dirent.name
    if (dirent.isDirectory()) return styleFiles(dir, path)
    return dirent.isFile() && path.endsWith('.css') ? [path] : []
  })
}

/** The plugin that refuses imports the host can't serve. */
function importGuard(): Plugin {
  return {
    name: 'automatos-theme:imports',
    enforce: 'pre',
    resolveId(source: string) {
      if (isSharedModule(source)) return { id: source, external: true }
      const refusal = importRefusal(source)
      if (refusal !== null) this.error(refusal)
      return null
    },
  }
}

/**
 * The plugin that wraps, renames and checks the built stylesheet. It works on the written file:
 * Vite emits the library's stylesheet during generateBundle, so the file on disk is the one place
 * every version of Vite and its bundler is sure to have it. A refused stylesheet is deleted and
 * fails the build with the server's reasons. (A build with `write: false` writes nothing to check.)
 */
function styleScope(state: { settings: Settings | null }): Plugin {
  return {
    name: 'automatos-theme:css',
    enforce: 'post',
    writeBundle(output) {
      const settings = state.settings
      if (settings === null) throw new Error('automatosTheme(): the config hook never ran, so the stylesheet has no htmlClass.')
      const dir = output.dir
      if (dir === undefined) throw new Error('automatosTheme(): the build has no output folder.')
      const styles = styleFiles(dir)
      if (styles.length === 0) return
      if (styles.length > 1 || styles[0] !== STYLE_FILE) {
        this.error(`A theme ships one stylesheet, ${STYLE_PATH}; this build made ${styles.join(', ')}.`)
      }
      const path = join(dir, STYLE_FILE)
      const css = transformThemeCss(readFileSync(path, 'utf8'), settings)
      const errors = cssScopeErrors(css, settings.htmlClass)
      if (errors.length > 0) {
        rmSync(path)
        this.error(errorReport(errors))
      }
      writeFileSync(path, css)
    },
  }
}

/** The theme preset: put it in a theme's `vite.config.ts` plugins. */
export function automatosTheme(options: ThemePresetOptions = {}): Plugin[] {
  const state: { settings: Settings | null } = { settings: null }
  const config: Plugin = {
    name: 'automatos-theme:config',
    config(userConfig) {
      const root = resolve(userConfig.root ?? process.cwd())
      const settings = settingsFor(options, root)
      state.settings = settings
      // A worker is bundled on its own: give it the same guards on imports and on the source tree.
      return { ...presetConfig(options, root, settings.htmlClass), worker: { plugins: () => [importGuard(), sourceGuard()] } }
    },
  }
  return [config, importGuard(), sourceGuard(), styleScope(state)]
}

