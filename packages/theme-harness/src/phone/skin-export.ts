/**
 * The skin designer's export and fixes (app/phone/designer/), held to `automatos-theme skin`'s own check (theme-cli's
 * skin-check.ts, which the command runs): a draft's block is offered as skin.json only when the command would write it,
 * so the vendored validator takes it and, after that, the theme holds every font and mascot file it names and no colour
 * pair is under its minimum. Otherwise every reason is given, in the command's words, and no file.
 *
 * The theme's files are the served theme's: its assets/ list (the build's) for the fonts and the mascot, and the
 * presets and prepaint table `check`'s measure reads (src/phone/contrast.ts measuredFiles). The file is a data: URL of
 * the block's text, so nothing is sent anywhere. A failing pair's fix is skin-check's `skinFixes`: the nearest value of
 * the pair's first token that passes (theme-cli's phone/nearest-passing.ts). No DOM.
 */
import type { MobileMeasure } from '@automatos/theme-cli/mobile-contrast'
import { checkSkin, skinFixes, skinText, type SkinFix } from '@automatos/theme-cli/skin-check'
import { measuredFiles } from './contrast.ts'
import { blockOf, withToken, type SkinDraft } from './designer.ts'
import type { PhoneSource } from './skin.ts'

export const SKIN_MEDIA_TYPE = 'application/json'
const DATA_PREFIX = `data:${SKIN_MEDIA_TYPE};charset=utf-8,`

export interface SkinExport {
  /** The `mobile` block, exactly what skin.json holds. */
  readonly block: Readonly<Record<string, unknown>>
  /** skin.json's text (skin-check.ts skinText). */
  readonly text: string
  /** Every reason `automatos-theme skin` refuses the block, as it prints them; empty: the file is offered. */
  readonly problems: readonly string[]
}

/** A draft's block checked as `automatos-theme skin` checks it, for the served theme (module comment). */
export function skinExport(source: PhoneSource, draft: SkinDraft): SkinExport {
  const block = blockOf(draft)
  const held = new Set(source.assets)
  const checked = checkSkin(source.manifest, block, { has: (path) => held.has(path), measured: measuredFiles(source) })
  const problems = checked.problems.map((error) => `${error.code} ${error.path}: ${error.message}`)
  return { block, text: skinText(block), problems }
}

/** The address a download link gives skin.json's text at: a data: URL, read where it is. */
export function skinHref(text: string): string {
  return `${DATA_PREFIX}${encodeURIComponent(text)}`
}

/** The text a skinHref holds, or null for any other address. */
export function textOfHref(href: string): string | null {
  return href.startsWith(DATA_PREFIX) ? decodeURIComponent(href.slice(DATA_PREFIX.length)) : null
}

/** The nearest passing value of each failing pair's first token, for a tokens draft measured as `check` measures it. */
export function draftFixes(draft: SkinDraft, measure: MobileMeasure | null): SkinFix[] {
  return skinFixes(blockOf(draft), measure)
}

/** The draft with a fix taken: the pair's first token set to its nearest passing value in the fix's scheme. */
export function withFix(draft: SkinDraft, fix: SkinFix): SkinDraft {
  return withToken(draft, fix.scheme === 'dark' ? 'dark' : 'light', fix.token, fix.value)
}
