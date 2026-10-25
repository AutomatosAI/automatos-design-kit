/**
 * The base layer core's every page draws on, which a theme's CSS was written against: Tailwind's preflight
 * (src/vendor/tailwind-preflight, as core's frontend/app/globals.css loads it with `@tailwind base`), then the rules
 * of globals.css's own `@layer base` that style elements (at core's 7cf67dc29969a817503a5aae67e5898f6b1de6bc):
 *
 * - every element's border in `hsl(var(--border))`, and the body in `hsl(var(--background))` on `hsl(var(--foreground))`
 *   (`* { @apply border-border }`, `body { @apply bg-background text-foreground }`), with core's values of those three
 *   tokens for Classic (`:root`, `.dark`) and Studio (`.studio`, `.studio.dark`); a theme's look paints its own on
 *   <html> (src/host/prepaint.ts), which win, as on core;
 * - Studio's type (`.studio`, the class the base puts on <html>): Geist for the page, Newsreader for h1 and h2, Geist
 *   Mono for code, each through the variable core's layout binds (app/index.html binds the same three).
 *
 * So a theme's boxes measure in the harness as in core (border-box, no default margins, buttons that inherit their
 * text). The mock host installs it (app/host.tsx) as the first sheet of the page's <head>, before the theme's
 * stylesheet, as globals.css comes before a theme's CSS on core; the phone view (/phone, Automatos Go's screens)
 * draws without it.
 */
import { PREFLIGHT_CSS } from '../vendor/tailwind-preflight/preflight.ts'

export const CORE_BASE_STYLE_ID = 'automatos-harness-core-base'

/** globals.css's Studio type stacks (`.studio`, `.studio h1, h2`, `.studio code`). */
const STUDIO_SANS = 'var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
const STUDIO_SERIF = 'var(--font-newsreader), "Tiempos Headline", Charter, "Iowan Old Style", Georgia, ui-serif, serif'
const STUDIO_MONO = 'var(--font-geist-mono), "JetBrains Mono", "Fira Code", "SF Mono", Monaco, Consolas, monospace'

/** globals.css's own base layer, in its order: the three tokens the element rules read, the element rules, Studio's type. */
export const CORE_BASE_LAYER_CSS = [
  ':root { --background: 0 0% 98%; --foreground: 0 0% 10%; --border: 0 0% 75%; }',
  '.dark { --background: 0 0% 6%; --foreground: 0 0% 98%; --border: 0 0% 15%; }',
  '.studio { --background: 38 50% 92%; --foreground: 30 12% 9%; --border: 40 30% 80%; }',
  '* { border-color: hsl(var(--border)); }',
  'body { background-color: hsl(var(--background)); color: hsl(var(--foreground)); }',
  '.studio.dark { --background: 30 12% 9%; --foreground: 38 40% 90%; --border: 30 10% 22%; color-scheme: dark; }',
  `.studio { font-family: ${STUDIO_SANS}; }`,
  `.studio h1, .studio h2, .studio .font-serif, .studio [data-studio-serif] { font-family: ${STUDIO_SERIF}; font-weight: 500; letter-spacing: -0.015em; line-height: 1.15; }`,
  `.studio .font-mono, .studio code, .studio kbd, .studio pre, .studio [data-studio-mono] { font-family: ${STUDIO_MONO}; font-feature-settings: "liga" 1, "calt" 1; }`,
].join('\n')

/** The whole base: the preflight, then core's own layer. */
export const CORE_BASE_CSS = `${PREFLIGHT_CSS}\n${CORE_BASE_LAYER_CSS}`

/** Adds the base once, as the first element of the document's head, so every later sheet (the theme's) wins a tie. */
export function installCoreBase(doc: Document): void {
  if (doc.getElementById(CORE_BASE_STYLE_ID) !== null) return
  const style = doc.createElement('style')
  style.id = CORE_BASE_STYLE_ID
  style.textContent = CORE_BASE_CSS
  doc.head.insertBefore(style, doc.head.firstChild)
}
