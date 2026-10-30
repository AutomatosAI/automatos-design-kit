/**
 * `automatos-theme previews <theme folder> --from <shots folder> [--pick <name>=<shot>]...` (PRD-261 B-02g): the
 * harness shots an owner picked (`automatos-theme shots`, B-02f) copied into the theme's listing previews, and
 * theme.json's `previews` set to them in the order given. Core's listing keeps theme.json's order and its cover is
 * the first preview listed (listings.py `_preview_paths`), so the first pick is the cover.
 *
 * A pick names a preview and the shot it is. The name is the preview's file stem, `<preset>` or `<preset>-<screen>`,
 * so the preview is assets/previews/<name>.png, and it belongs to the preset core's listing shows it under
 * (listings.py `_owner_preset`, as check/previews.ts ports it: the longest preset id first); a name no preset
 * claims is refused. The shot is a PNG under the shots folder, as `shots` lays it out
 * (`<browser>/<preset>/<width>/<view>.png`). With no --pick, each preset gets `<preset>.png`: its first view (the
 * harness's order, slots, pages, then routes) on Chromium at 1440 px, the default look first.
 *
 * `--phone <screenshots folder>` in place of `--from` writes the phone's list instead, theme.json's `phonePreviews`,
 * from Automatos Go screenshots: previews-phone.ts. Either way every pick is checked before anything is written
 * (previews-pick.ts): the name, the file (a PNG of at most 512 KB: files.ts's preview kind, the reader's own rule)
 * and the list (core's manifest rule for `previews`: at most 24). Nothing is sent anywhere.
 *
 * An owner picks and commits a theme's previews (PRD-261 PB-24); `check` then lists them under their presets.
 * Exit code 0 when written, 1 when refused (every reason printed, nothing written), 2 for a usage error.
 */
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { declaredIn, presetOrder, SHOT_SUFFIX, SHOT_WIDTHS, viewsOf, viewSlug } from '@automatos/theme-harness/router'
import { PREVIEWS_FIELD } from './check-package.ts'
import { PREVIEW_DIR, PREVIEW_SUFFIX } from './check/previews.ts'
import type { CommandDeps } from './cli-main.ts'
import { PRESETS_DIR } from './looks.ts'
import type { Output } from './output.ts'
import { PHONE_TARGET } from './previews-phone.ts'
import {
  formatsOf, isFolder, plannedPreviews, readTheme, writePreviews, type PreviewPick, type PreviewTarget, type Theme,
} from './previews-pick.ts'

export type { PreviewPick } from './previews-pick.ts'

export const PREVIEWS_USAGE = (
  'usage: automatos-theme previews <theme folder> (--from <shots folder> | --phone <screenshots folder>) '
  + '[--pick <name>=<file>]...'
)
/** The shot a preset's preview is with no --pick: shots/playwright.config.ts's first browser, at the first width. */
export const DEFAULT_BROWSER = 'chromium'
export const DEFAULT_WIDTH = SHOT_WIDTHS[0]

const EXIT_OK = 0
const EXIT_REFUSED = 1
const EXIT_USAGE = 2
const PREVIEW_KIND = 'preview'
const PICK_SEPARATOR = '='

type JsonObject = Readonly<Record<string, unknown>>

interface PreviewsArgs {
  readonly themeDir: string
  /** The folder the picks come from: the shots folder, or with --phone the phone screenshots' folder. */
  readonly fromDir: string
  readonly phone: boolean
  /** The picks in the order given; null when there is none. */
  readonly picks: readonly PreviewPick[] | null
}

/** `<name>=<shot>`, both sides given, or null. */
function pickOf(text: string): PreviewPick | null {
  const at = text.indexOf(PICK_SEPARATOR)
  if (at <= 0 || at === text.length - 1) return null
  return { name: text.slice(0, at), shot: text.slice(at + 1) }
}

/** The folders and picks from the arguments, or null when they don't make one command: --from or --phone, not both. */
function parsePreviews(argv: readonly string[], cwd: string): PreviewsArgs | null {
  try {
    const { positionals, values } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: { from: { type: 'string' }, phone: { type: 'string' }, pick: { type: 'string', multiple: true } },
    })
    const [command, themeDir, ...extra] = positionals
    const fromDir = values.from ?? values.phone
    const both = values.from !== undefined && values.phone !== undefined
    if (command !== 'previews' || themeDir === undefined || extra.length > 0 || fromDir === undefined || both) return null
    const given = values.pick ?? []
    const picks = given.map(pickOf).filter((pick): pick is PreviewPick => pick !== null)
    if (picks.length !== given.length) return null
    const phone = values.phone !== undefined
    return { themeDir: resolve(cwd, themeDir), fromDir: resolve(cwd, fromDir), phone, picks: picks.length === 0 ? null : picks }
  } catch {
    return null
  }
}

/** With no --pick: each preset's first view on Chromium at 1440 px, as `<preset>.png`, the default look first. */
export function defaultPicks(manifest: JsonObject, presets: readonly string[]): PreviewPick[] {
  const first = viewsOf(declaredIn(manifest))[0]
  if (first === undefined) return []
  const look = typeof manifest.look === 'string' ? manifest.look : undefined
  const view = `${viewSlug(first)}${SHOT_SUFFIX}`
  const shotOf = (preset: string): string => [DEFAULT_BROWSER, preset, String(DEFAULT_WIDTH), view].join('/')
  return presetOrder(presets, look).map((preset) => ({ name: preset, shot: shotOf(preset) }))
}

/** The web's list: theme.json's `previews`, PNGs in assets/previews/ from the harness shots. */
const WEB_TARGET: PreviewTarget = {
  field: PREVIEWS_FIELD,
  folder: PREVIEW_DIR,
  formats: formatsOf(PREVIEW_KIND, { 'image/png': PREVIEW_SUFFIX }),
  noun: 'preview',
  pathShape: `${PREVIEW_DIR}<name>${PREVIEW_SUFFIX}`,
  notPicture: 'its bytes are not a PNG image',
  folderWord: 'shots folder',
  fileWord: 'shot',
  coverWord: "the listing's cover",
  notAFolder: (folder) => `${folder} is not a folder: --from takes the folder automatos-theme shots wrote.`,
  defaultPicks: (theme: Theme) => {
    const picks = defaultPicks(theme.document, theme.presets)
    return picks.length > 0 ? picks : `the theme has no preset in ${PRESETS_DIR}, and a preview belongs to one: build the theme first.`
  },
}

function refused(output: Output, themeDir: string, problems: readonly string[]): number {
  output.err(`automatos-theme previews: nothing was written to ${themeDir}, because:`)
  problems.forEach((problem) => output.err(`  ${problem}`))
  return EXIT_REFUSED
}

/** Runs `previews` in the folder `cwd`; returns the exit code. */
export function runPreviews(argv: readonly string[], output: Output, cwd: string): number {
  const args = parsePreviews(argv, cwd)
  if (args === null) {
    output.err(PREVIEWS_USAGE)
    return EXIT_USAGE
  }
  const theme = readTheme(args.themeDir)
  if (typeof theme === 'string') return refused(output, args.themeDir, [theme])
  const target = args.phone ? PHONE_TARGET : WEB_TARGET
  if (!isFolder(args.fromDir)) return refused(output, args.themeDir, [target.notAFolder(args.fromDir)])
  const picks = args.picks ?? target.defaultPicks(theme, args.fromDir)
  if (typeof picks === 'string') return refused(output, args.themeDir, [picks])
  const { previews, problems } = plannedPreviews(picks, theme, args.fromDir, target)
  if (problems.length > 0) return refused(output, args.themeDir, problems)
  writePreviews(args.themeDir, theme, previews, target, output)
  return EXIT_OK
}

/** The command table's runner (cli-main.ts COMMANDS). */
export function previewsCommand(argv: readonly string[], output: Output, deps: CommandDeps): number {
  return runPreviews(argv, output, deps.cwd)
}
