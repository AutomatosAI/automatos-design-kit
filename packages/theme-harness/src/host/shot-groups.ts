/**
 * PRD-261 B-02f: the shots' groups (one Playwright test each, shots/shots.spec.ts) and the address each shot opens.
 * No DOM and no React, so the spec (Node) and the tests read the same plan.
 *
 * - Each preset, the default look first, at 1440 and 1024 px, then the default look just below the theme's minWidth:
 *   every view the theme serves, with reduced motion, as the shots' determinism asks.
 * - For a theme with a /chat page, the chat page once more in the default look at 1440 px with motion allowed (the
 *   host's reduced motion off, and the browser asked for none), so the shots show what only moves: Auto's clip and the
 *   Pause Auto control beside it (WCAG 2.2.2), which reduced motion never draws.
 */
import {
  belowWidth, DEFAULT_SETTINGS, expectedShots, pagePath, settingsQuery, SHOT_SUFFIX, SHOT_WIDTHS, viewSlug, type Served, type View,
} from './router.ts'

/** The page the chat groups shoot. */
export const CHAT_PAGE = '/chat'
/** The width the chat groups shoot at: the wider desktop width. */
export const CHAT_GROUP_WIDTH = SHOT_WIDTHS[0]
/** The motion group's folder beside its preset's 1440 folder: `<preset>/1440-motion`, which no preset or width takes. */
export const MOTION_SUFFIX = '-motion'

/** One test of the shots: a preset (null for a theme with none) at one width, into its own folder. */
export interface ShotGroup {
  readonly folder: string
  readonly preset: string | null
  readonly width: number
  /** True for every group but the motion one: the host's reduced motion on, and the browser asked for it. */
  readonly reducedMotion: boolean
  /** The one page the group shoots; null for every view the theme serves. */
  readonly page: string | null
}

const NO_PRESET_FOLDER = 'default'

const folderOf = (preset: string | null, width: number): string => `${preset ?? NO_PRESET_FOLDER}/${width}`

/** A group of every view, with reduced motion. */
function everyView(folder: string, preset: string | null, width: number): ShotGroup {
  return { folder, preset, width, reducedMotion: true, page: null }
}

/** The chat page with motion allowed, in the default look at 1440 px; none for a theme without a /chat page. */
function chatGroups(preset: string | null, pages: readonly string[]): ShotGroup[] {
  if (!pages.includes(CHAT_PAGE)) return []
  const folder = `${folderOf(preset, CHAT_GROUP_WIDTH)}${MOTION_SUFFIX}`
  return [{ folder, preset, width: CHAT_GROUP_WIDTH, reducedMotion: false, page: CHAT_PAGE }]
}

/**
 * Each preset (default first) at each desktop width, then the default look just below the theme's minWidth, then the
 * chat groups for a theme whose `pages` (theme.json's routes) hold /chat.
 */
export function shotGroups(presets: readonly string[], minWidth: number, pages: readonly string[] = []): ShotGroup[] {
  const looks: readonly (string | null)[] = presets.length === 0 ? [null] : presets
  const desktop = looks.flatMap((preset) => SHOT_WIDTHS.map((width) => everyView(folderOf(preset, width), preset, width)))
  const below = belowWidth(minWidth)
  const narrow = below === null ? [] : [everyView(`below-${below}`, looks[0], below)]
  return [...desktop, ...narrow, ...chatGroups(looks[0], pages)]
}

/** The address a shot opens: the view's path, the group's look, width and motion, no toolbar. */
export function shotAddress(group: ShotGroup, path: string): string {
  const { preset, width, reducedMotion } = group
  return `/${settingsQuery({ ...DEFAULT_SETTINGS, path, preset, width, reducedMotion, toolbar: false })}`
}

/** The views a group shoots, of those the page drew: every one, or its one page. */
export function groupViews(group: ShotGroup, views: readonly View[]): View[] {
  return group.page === null ? [...views] : views.filter((view) => view.kind === 'page' && view.key === group.page)
}

/** The PNG files a group must hold: every view's (expectedShots), or its one page's while the theme serves that page. */
export function groupShots(group: ShotGroup, declared: Served, missing: Served): string[] {
  const all = expectedShots(declared, missing)
  if (group.page === null) return all
  const file = `${viewSlug({ kind: 'page', key: group.page, path: pagePath(group.page) })}${SHOT_SUFFIX}`
  return all.filter((name) => name === file)
}
