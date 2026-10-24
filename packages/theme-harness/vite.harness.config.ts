/**
 * PRD-261 B-02e: builds and serves the browser harness (app/) for one theme folder, AUTOMATOS_HARNESS_THEME
 * (default themes/play), which `automatos-theme shots` sets:
 *
 *   node <vite>/bin/vite.js build   --config packages/theme-harness/vite.harness.config.ts
 *   node <vite>/bin/vite.js preview --config packages/theme-harness/vite.harness.config.ts   (http://127.0.0.1:4318)
 *
 * `automatos-theme dev` (PRD-261 B-02i) runs the same build with `--outDir <a folder of its own>` after each change
 * and serves that folder itself (packages/theme-cli/src/dev-server.ts); every plugin here writes to the build's own
 * output folder, so the build is the same wherever it goes.
 *
 * - The theme's src/entry.ts is bundled with the app, its bare imports resolved by the harness's import map
 *   (src/host/import-map.ts): @automatos/theme-sdk is the fake SDK, React the app's own copy.
 * - The theme folder's theme.json, looks/presets/*.look.json and boot/prepaint.json reach the app through one
 *   module (app/served-theme.d.ts), read when the build asks for it; the app checks them. The module also lists the
 *   folder's files under assets/, which the phone view gives URLs for only as core's answer does (for a file the
 *   package holds).
 * - Its CSS is made as the theme's own build makes dist/theme.css: CSS modules name the classes first, with the
 *   preset's pattern (<htmlClass>-[local]-[hash]); the build writes one stylesheet (cssCodeSplit off, unminified, as
 *   the preset's); then, on the written file as the preset's styleScope works, the vite-preset's theme-css step wraps
 *   it under html.<htmlClass> and renames its keyframes and font families once over the whole sheet (themeStylesheet).
 *   The wrap is the preset's default form, html.<htmlClass>. It can't run in css.postcss: Vite puts postcss-modules
 *   first, and that plugin names classes in OnceExit, after every plugin's Once, so a wrap there would be renamed as
 *   a local class. Then the sheet's `@media (prefers-reduced-motion: reduce)` and `@media (forced-colors: active)`
 *   rules are copied under the toolbar's attributes (src/host/prepaint.ts), so the toolbar can show them; a query
 *   with more than that one feature is left as it is. Vite's dev server writes no file, so draw from the build.
 * - The folder's assets/ is copied to the output's assets/, so the stylesheet's ../assets/ URLs (left as written,
 *   as in the package) and the SDK's assetUrl find the files there; the app's own files go under harness/.
 * - The host's fonts (app/fonts/core, core's own files) are the page's: app/index.html's <style> declares their
 *   @font-face rules and binds core's --font-* variables on <html>, as core's layout does. Vite keeps a page's
 *   <style> in the page, out of the one stylesheet, so the theme's wrap never reaches it, and emits each url()'s
 *   file under harness/, on the harness's origin.
 */
import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkedOptions, themeCssPlugin } from '@automatos/vite-preset/theme-css'
import postcss, { type AtRule, type Plugin as PostcssPlugin, type Rule } from 'postcss'
import { defineConfig, type Plugin, type UserConfig } from 'vite'
import { dedupedPackages, importMapAliases } from './src/host/import-map.ts'
import { FORCED_ACTIVE, HTML_ATTRS, MOTION_REDUCE } from './src/host/prepaint.ts'
import { HARNESS_HOST, HARNESS_PORT, PRESET_SUFFIX, THEME_ENV } from './src/host/router.ts'

export const HARNESS_DIR = fileURLToPath(new URL('.', import.meta.url))
export const DEFAULT_THEME_DIR = resolve(HARNESS_DIR, '../../themes/play')
/** Where the build writes the app (git ignores every package's dist/). */
export const APP_OUT_DIR = join(HARNESS_DIR, 'dist/app')

const SERVED_ID = 'virtual:automatos-harness/theme'
const RESOLVED_SERVED_ID = `\0${SERVED_ID}`
const MANIFEST_FILE = 'theme.json'
const ENTRY_FILE = 'src/entry.ts'
const PRESETS_DIR = 'looks/presets'
const PREPAINT_FILE = 'boot/prepaint.json'
const ASSETS_DIR = 'assets'
/** The app's own scripts and stylesheets, beside the theme's assets/. */
export const APP_ASSETS_DIR = 'harness'
const CSS_SUFFIX = '.css'

/** The theme folder to draw, from the environment. */
export function harnessThemeDir(env: NodeJS.ProcessEnv = process.env): string {
  return resolve(env[THEME_ENV] ?? DEFAULT_THEME_DIR)
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown
  } catch (error) {
    throw new Error(`The theme harness can't read ${path} as JSON (${String(error)}).`)
  }
}

/** theme.json's htmlClass, which the theme's stylesheet is wrapped under; a throw for one the server would refuse. */
function htmlClassOf(themeDir: string): string {
  const manifest = readJson(join(themeDir, MANIFEST_FILE)) as { htmlClass?: unknown } | null
  if (typeof manifest?.htmlClass !== 'string') throw new Error(`${join(themeDir, MANIFEST_FILE)} has no "htmlClass".`)
  return checkedOptions({ htmlClass: manifest.htmlClass }).htmlClass
}

/** Every file under the theme folder's assets/, as 'assets/<path>' with '/' between folders, sorted. */
export function assetPaths(themeDir: string): string[] {
  const dir = join(themeDir, ASSETS_DIR)
  if (!existsSync(dir)) return []
  return readdirSync(dir, { encoding: 'utf8', recursive: true })
    .filter((rel) => statSync(join(dir, rel)).isFile())
    .map((rel) => `${ASSETS_DIR}/${rel.split(sep).join('/')}`)
    .sort()
}

/** The served module: the folder's files as data, its assets' paths, and the entry as a dynamic import. */
export function servedThemeCode(themeDir: string): string {
  const entry = join(themeDir, ENTRY_FILE)
  if (!existsSync(entry)) throw new Error(`${themeDir} has no ${ENTRY_FILE}: the harness draws a theme folder's entry.`)
  const presetsDir = join(themeDir, PRESETS_DIR)
  const names = existsSync(presetsDir) ? readdirSync(presetsDir).filter((name) => name.endsWith(PRESET_SUFFIX)).sort() : []
  const prepaintPath = join(themeDir, PREPAINT_FILE)
  const files = {
    manifest: readJson(join(themeDir, MANIFEST_FILE)),
    presets: names.map((name) => readJson(join(presetsDir, name))),
    prepaint: existsSync(prepaintPath) ? readJson(prepaintPath) : null,
  }
  return [
    `export const files = ${JSON.stringify(files)}`,
    `export const assets = ${JSON.stringify(assetPaths(themeDir))}`,
    `export function loadEntry() { return import(${JSON.stringify(entry)}) }`,
  ].join('\n')
}

function servedTheme(themeDir: string): Plugin {
  return {
    name: 'automatos-harness:theme',
    resolveId(source) {
      return source === SERVED_ID ? RESOLVED_SERVED_ID : null
    },
    load(id) {
      return id === RESOLVED_SERVED_ID ? servedThemeCode(themeDir) : null
    },
  }
}

/** Copies the theme folder's assets/ into the output, where the package's files root has it. */
function themeAssets(themeDir: string): Plugin {
  return {
    name: 'automatos-harness:assets',
    apply: 'build',
    writeBundle(options) {
      const source = join(themeDir, ASSETS_DIR)
      if (options.dir === undefined || !existsSync(source)) return
      cpSync(source, join(options.dir, ASSETS_DIR), { recursive: true })
    },
  }
}

/** Each single-feature media query the toolbar stands in for, and the <html> attribute it stands in with. */
const MIRRORED_MEDIA: readonly (readonly [RegExp, string])[] = [
  [/^\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)$/i, `html[${HTML_ATTRS.motion}="${MOTION_REDUCE}"]`],
  [/^\(\s*forced-colors\s*:\s*active\s*\)$/i, `html[${HTML_ATTRS.forcedColors}="${FORCED_ACTIVE}"]`],
]
const LEADING_HTML = /^html(?![\w-])/i
const LEADING_WHERE_HTML = /^:where\(html(?![\w-])/i

/** A selector under the attribute: `html.play .x` becomes `html[attr].play .x`. */
export function underAttribute(selector: string, scope: string): string {
  const text = selector.trim()
  if (LEADING_HTML.test(text)) return `${scope}${text.replace(LEADING_HTML, '')}`
  if (LEADING_WHERE_HTML.test(text)) return `:where(${scope}${text.replace(LEADING_WHERE_HTML, '')}`
  return `${scope} ${text}`
}

function mirroredRules(atRule: AtRule, scope: string): Rule[] {
  const rules = (atRule.nodes ?? []).filter((node): node is Rule => node.type === 'rule')
  return rules.map((rule) => rule.clone({ selectors: rule.selectors.map((selector) => underAttribute(selector, scope)) }))
}

/** Copies each mirrored media block's rules, after it, under its attribute. */
export function mediaMirror(): PostcssPlugin {
  return {
    postcssPlugin: 'automatos-harness-media-mirror',
    OnceExit(root) {
      root.walkAtRules('media', (atRule) => {
        const scope = MIRRORED_MEDIA.find(([query]) => query.test(atRule.params.trim()))?.[1]
        if (scope !== undefined) atRule.after(mirroredRules(atRule, scope))
      })
    },
  }
}

/**
 * The theme's whole stylesheet as the harness draws it: the vite-preset's theme-css step (wrap and rename, once over
 * the sheet, as the preset runs it on dist/theme.css), then its reduced-motion and forced-colours rules mirrored.
 */
export function harnessStylesheet(css: string, htmlClass: string): string {
  return postcss([themeCssPlugin({ htmlClass }), mediaMirror()]).process(css, { from: undefined }).css
}

/** Rewrites each stylesheet the build wrote to the app's folder of `outDir` with harnessStylesheet; returns their paths. */
export function wrapWrittenStylesheets(outDir: string, htmlClass: string): string[] {
  const dir = join(outDir, APP_ASSETS_DIR)
  const names = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(CSS_SUFFIX)) : []
  return names.map((name) => {
    const path = join(dir, name)
    writeFileSync(path, harnessStylesheet(readFileSync(path, 'utf8'), htmlClass))
    return path
  })
}

/** The wrap on the written stylesheet, after CSS modules named its classes (the vite-preset's styleScope works so too). */
function themeStylesheet(htmlClass: string): Plugin {
  return {
    name: 'automatos-harness:theme-css',
    apply: 'build',
    enforce: 'post',
    writeBundle(options) {
      if (options.dir === undefined) throw new Error('The theme harness build has no output folder, so its stylesheet would go unwrapped.')
      wrapWrittenStylesheets(options.dir, htmlClass)
    },
  }
}

/** The harness's Vite config for one theme folder. */
export function harnessConfig(themeDir: string): UserConfig {
  const htmlClass = htmlClassOf(themeDir)
  return {
    root: join(HARNESS_DIR, 'app'),
    base: '/',
    publicDir: false,
    plugins: [servedTheme(themeDir), themeAssets(themeDir), themeStylesheet(htmlClass)],
    resolve: { alias: importMapAliases(), dedupe: dedupedPackages() },
    oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
    css: {
      transformer: 'postcss',
      // Given, so Vite reads no postcss.config.* (as the preset); the wrap runs on the written file (themeStylesheet).
      postcss: { plugins: [] },
      modules: { generateScopedName: `${htmlClass}-[local]-[hash:base64:5]` },
    },
    build: {
      outDir: APP_OUT_DIR,
      emptyOutDir: true,
      assetsDir: APP_ASSETS_DIR,
      sourcemap: false,
      // One stylesheet, unminified, as the preset writes dist/theme.css: the wrap renames over all of it at once.
      cssCodeSplit: false,
      cssMinify: false,
    },
    preview: { host: HARNESS_HOST, port: HARNESS_PORT, strictPort: true },
    server: { host: HARNESS_HOST, port: HARNESS_PORT, strictPort: true },
  }
}

export default defineConfig(harnessConfig(harnessThemeDir()))
