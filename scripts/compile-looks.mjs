#!/usr/bin/env node
// compile-looks: Play's look catalogue and presets (themes/play/src/lib/looks/catalogue.ts and presets.ts)
// into the package's look data (PRD-261 A-16c): looks/schema.json, looks/presets/<id>.look.json and
// boot/prepaint.json, with the glow as a numeric-knob rule. The work is in scripts/looks/compile.ts.
//
//   node scripts/compile-looks.mjs [themeDir]     (default: themes/play; Play's build passes ".")
//
// Plain Node, no dependencies. Node strips the TypeScript types itself (Node 22.18 or later). Play's
// modules import each other without a file extension, as a bundler allows, so a resolve hook adds
// ".ts" to such an import, and only for modules under themes/play/src/.
import * as nodeModule from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLAY_SOURCE_URL = new URL('../themes/play/src/', import.meta.url).href
const DEFAULT_THEME_DIR = fileURLToPath(new URL('../themes/play/', import.meta.url))
const HAS_EXTENSION = /\.[A-Za-z0-9]+$/

/** True for './x' or '../x/y' whose last segment has no extension. */
function isExtensionlessRelative(specifier) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return false
  const last = specifier.slice(specifier.lastIndexOf('/') + 1)
  return last !== '' && last !== '..' && !HAS_EXTENSION.test(last)
}

function resolveHook(specifier, context, nextResolve) {
  const fromPlay = typeof context.parentURL === 'string' && context.parentURL.startsWith(PLAY_SOURCE_URL)
  if (fromPlay && isExtensionlessRelative(specifier)) return nextResolve(`${specifier}.ts`, context)
  return nextResolve(specifier, context)
}

async function main(argv) {
  if (typeof nodeModule.registerHooks !== 'function') {
    throw new Error(`compile-looks needs Node 22.18 or later (module.registerHooks); this is ${process.version}.`)
  }
  if (argv.length > 1) throw new Error('usage: node scripts/compile-looks.mjs [themeDir]')
  nodeModule.registerHooks({ resolve: resolveHook })
  const themeDir = argv.length === 1 ? resolve(argv[0]) : DEFAULT_THEME_DIR
  const { writeLookFiles } = await import('./looks/compile.ts')
  const written = writeLookFiles(themeDir)
  process.stdout.write(`compile-looks: wrote ${written.length} files in ${themeDir}: ${written.join(', ')}\n`)
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`compile-looks: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
