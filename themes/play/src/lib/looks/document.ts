import { applyCssVars, type CssVars } from '@automatos/look-kit/css'

import { LOOK_VAR_NAMES, STUDIO_TOKEN_NAMES, lookToCssVars, lookToStudioTokens } from './engine'
import type { Look } from './types'

/**
 * PRD-260 K3 — the look on <html>: inline custom properties, which outrank
 * .studio and .studio.dark, set only while the style is play. Leaving Play
 * removes every one, so Classic and Studio are exactly as before. Motion is the
 * host's (data-theme-motion and --theme-motion): since Play 1.1.1 this file
 * writes no motion mark of its own (PRD-261 K-21).
 */

/** Play's variables and Studio's tokens for a look: what the host's boot script and look runtime set. */
export function lookDocumentVars(look: Look): CssVars {
  return { ...lookToCssVars(look), ...lookToStudioTokens(look) }
}

/** Every inline property the look owns on <html>. */
export const LOOK_DOCUMENT_NAMES: readonly string[] = [...LOOK_VAR_NAMES, ...STUDIO_TOKEN_NAMES]

export function applyLook(root: HTMLElement, look: Look): void {
  applyCssVars(root, lookDocumentVars(look))
}

/** Takes every property the look set off <html>; other inline styles and attributes stay. */
export function clearLook(root: HTMLElement): void {
  LOOK_DOCUMENT_NAMES.forEach((name) => root.style.removeProperty(name))
}
