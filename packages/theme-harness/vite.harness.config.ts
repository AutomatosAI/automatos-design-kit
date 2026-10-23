/**
 * PRD-261 B-02e: builds and serves the browser harness (app/) for one theme folder, AUTOMATOS_HARNESS_THEME
 * (default themes/play), which `automatos-theme shots` sets:
 *
 *   node <vite>/bin/vite.js build   --config packages/theme-harness/vite.harness.config.ts
 *   node <vite>/bin/vite.js preview --config packages/theme-harness/vite.harness.config.ts   (http://127.0.0.1:4318)
 *
 * - The theme's src/entry.ts is bundled with the app, its bare imports resolved by the harness's import map
 *   (src/host/import-map.ts): @automatos/theme-sdk is the fake SDK, React the app's own copy.
 * - The theme folder's theme.json, looks/presets/*.look.json and boot/prepaint.json reach the app through one
 *   module (app/served-theme.d.ts), read when the build asks for it; the app checks them.
 * - Its CSS is wrapped as the theme's own build wraps it (the vite-preset's theme-css step, under html.<htmlClass>),
 *   with the same CSS module names, and its `@media (prefers-reduced-motion: reduce)` and
 *   `@media (forced-colors: active)` rules are copied under the toolbar's attributes (src/host/prepaint.ts), so the
 *   toolbar can show them; a query with more than that one feature is left as it is.
 * - The folder's assets/ is copied to the output's assets/, so the stylesheet's ../assets/ URLs (left as written,
 *   as in the package) and the SDK's assetUrl find the files there; the app's own files go under harness/.
 */
import { cpSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { themeCssPlugin } from '@automatos/vite-preset/theme-css'
import type { AtRule, Plugin as PostcssPlugin, Rule } from 'postcss'
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
const APP_ASSETS_DIR = 'harness'

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

/** theme.json's htmlClass, which the theme's stylesheet is wrapped under. */
function htmlClassOf(themeDir: string): string {
  const manifest = readJson(join(themeDir, MANIFEST_FILE)) as { htmlClass?: unknown } | null
  if (typeof manifest?.htmlClass !== 'string') throw new Error(`${join(themeDir, MANIFEST_FILE)} has no "htmlClass".`)
  return manifest.htmlClass
}

/** The served module: the folder's files as data, and the entry as a dynamic import. */
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
  return [`export const files = ${JSON.stringify(files)}`, `export function loadEntry() { return import(${JSON.stringify(entry)}) }`].join('\n')
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

/** The harness's Vite config for one theme folder. */
export function harnessConfig(themeDir: string): UserConfig {
  const htmlClass = htmlClassOf(themeDir)
  return {
    root: join(HARNESS_DIR, 'app'),
    base: '/',
    publicDir: false,
    plugins: [servedTheme(themeDir), themeAssets(themeDir)],
    resolve: { alias: importMapAliases(), dedupe: dedupedPackages() },
    oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
    css: {
      transformer: 'postcss',
      postcss: { plugins: [themeCssPlugin({ htmlClass }), mediaMirror()] },
      modules: { generateScopedName: `${htmlClass}-[local]-[hash:base64:5]` },
    },
    build: { outDir: APP_OUT_DIR, emptyOutDir: true, assetsDir: APP_ASSETS_DIR, sourcemap: false },
    preview: { host: HARNESS_HOST, port: HARNESS_PORT, strictPort: true },
    server: { host: HARNESS_HOST, port: HARNESS_PORT, strictPort: true },
  }
}

export default defineConfig(harnessConfig(harnessThemeDir()))
