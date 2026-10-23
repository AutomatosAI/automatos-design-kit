/**
 * The files `check design` (design.ts) reads from a theme folder, as they are on disk: looks/schema.json,
 * every looks/presets/<name>, boot/prepaint.json and design/contrast.json.
 *
 * The folders they sit in are looked at first, each before the folders inside it, without following a
 * link (collect.ts `statOf`, as pack looks). A folder that is a link, or a file where the folder goes,
 * is given as one entry at the folder's own path (`link: true` for a link), which design.ts refuses.
 * Nothing under it is read, and a folder inside it is never looked at, so a file in a folder's place
 * can't make a lookup under it fail part way (ENOTDIR).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { isHidden, statOf } from '../collect.ts'
import { PREPAINT_PATH } from '../core/css-value.ts'
import { presetPaths, PRESETS_DIR, SCHEMA_PATH } from '../looks.ts'
import type { PackageEntry } from '../members.ts'

export const DESIGN_CONTRAST_PATH = 'design/contrast.json'
export const LOOKS_FOLDER = posix.dirname(SCHEMA_PATH)
const PRESETS_FOLDER = PRESETS_DIR.replace(/\/$/, '')
/** The folders the design files sit in, each before the folders inside it. */
export const DESIGN_FOLDERS: readonly string[] = [LOOKS_FOLDER, PRESETS_FOLDER, posix.dirname(PREPAINT_PATH), posix.dirname(DESIGN_CONTRAST_PATH)]
const EMPTY = new Uint8Array(0)

type Kind = ReturnType<typeof statOf>

function entryAt(themeDir: string, path: string): PackageEntry[] {
  const kind = statOf(themeDir, path)
  if (kind === 'link') return [{ path, data: EMPTY, link: true }]
  return kind === 'file' ? [{ path, data: new Uint8Array(readFileSync(join(themeDir, path))) }] : []
}

/** True when every design folder `path` sits in is a folder on disk, by `kinds` (a folder not looked at is not). */
function readableIn(kinds: ReadonlyMap<string, Kind>, path: string): boolean {
  return DESIGN_FOLDERS.every((folder) => !path.startsWith(`${folder}/`) || kinds.get(folder) === 'folder')
}

/** What each design folder is on disk; one inside a link, a file or nothing is never looked at. */
function folderKinds(themeDir: string): ReadonlyMap<string, Kind> {
  return DESIGN_FOLDERS.reduce<ReadonlyMap<string, Kind>>((kinds, folder) => (
    readableIn(kinds, folder) ? new Map<string, Kind>([...kinds, [folder, statOf(themeDir, folder)]]) : kinds
  ), new Map<string, Kind>())
}

/** A theme folder's design files (schema, presets, prepaint table, pairs), after each design folder that is a link or a file. */
export function readDesignFiles(themeDir: string): PackageEntry[] {
  const kinds = folderKinds(themeDir)
  const readable = (path: string): boolean => readableIn(kinds, path)
  const presets = readable(PRESETS_DIR)
    ? readdirSync(join(themeDir, PRESETS_FOLDER)).filter((name) => !isHidden(name)).map((name) => `${PRESETS_DIR}${name}`)
    : []
  const inTheWay = Array.from(kinds).flatMap(([path, kind]): PackageEntry[] => (
    kind === 'link' || kind === 'file' ? [{ path, data: EMPTY, link: kind === 'link' }] : []
  ))
  const paths = [SCHEMA_PATH, ...presetPaths(presets), PREPAINT_PATH, DESIGN_CONTRAST_PATH].filter(readable)
  return [...inTheWay, ...paths.flatMap((path) => entryAt(themeDir, path))]
}
