/**
 * The host values the vendored validators import from core modules this kit does not copy.
 *
 * Each value is copied from automatos-ai at the commit named in README.md:
 * - THEME_HOST_VERSION and SDK_VERSION: frontend/lib/theme-host/shared-modules.json ("hostVersion",
 *   "sdkVersion"), equal to THEME_HOST_VERSION and SDK_VERSION in orchestrator/services/themes/contract.py;
 * - HTML_CLASS_PATTERN: frontend/lib/theme-host/constants.ts;
 * - LOOK_ID_PATTERN: frontend/lib/look-kit/validate.ts.
 * A new host release that changes one of them is a re-vendor (README.md says how).
 */
export const THEME_HOST_VERSION: string = '1.1.0'
export const SDK_VERSION: string = '1.2.0'

/** A theme's own class on <html>: 3 to 32 characters, lower-case letters, digits and hyphens. */
export const HTML_CLASS_PATTERN = /^[a-z][a-z0-9-]{2,31}$/

/** A look's id, and a preset's file name. */
export const LOOK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
