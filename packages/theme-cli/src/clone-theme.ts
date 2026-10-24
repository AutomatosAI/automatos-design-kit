/**
 * What `automatos-theme clone` (PRD-261 B-04c, clone.ts) writes into a theme folder: the route's core files under
 * reference/core/<path>, read-only, and theme.json's `pages[route]` set to a clone of one of them.
 *
 * reference/ is a reading copy, never part of the package: pack collects only theme.json, the top docs and dist/,
 * boot/, looks/ and assets/ (collect.ts), with src/ as source/ (source.ts), and a theme's build, lint and typecheck
 * read its src/ and tests. A file already there from an earlier clone is replaced.
 *
 * The page entry is core's (guides/contract.md, "Pages"): `{"mode": "clone", "clonedFrom": {"path", "sha"}}`, with
 * the `keepCorePage` list the entry had before, if any. theme.json keeps the author's layout when it has no `pages`
 * yet: the field is added after the last one, indented as the first is. Otherwise, or when that edit doesn't read
 * back as the document with the page set, the file is written again as JSON with two-space indents (as theme-json.ts
 * does for the lists it sets).
 */
import { chmodSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { isRecord, own, type JsonRecord } from './core/css-value.ts'
import type { CoreFile } from './clone-source.ts'

/** Where the core files land in the theme folder, each at its PAGE_SOURCES path. */
export const REFERENCE_DIR = 'reference/core'
/** Read-only for everyone: the copy is for reading. */
export const READ_ONLY = 0o444
export const MANIFEST_FILE = 'theme.json'
export const CLONE_MODE = 'clone'
const PAGES_FIELD = 'pages'
const KEEP_FIELD = 'keepCorePage'
const BOM = '﻿'
const INDENT_STEP = '  '
/** The indent of the document's first field, which a field added at the end takes. */
const FIELD_INDENT = /^([ \t]+)"/m
const OBJECT_OPEN = '{'
const OBJECT_CLOSE = '}'

/** theme.json as read: its text and the object it parses to. */
export interface ThemeManifest {
  readonly text: string
  readonly document: JsonRecord
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function parsed(text: string): unknown {
  return JSON.parse(text.startsWith(BOM) ? text.slice(BOM.length) : text)
}

/** theme.json of `themeDir`, or why clone can't set a page in it. */
export function readThemeManifest(themeDir: string): ThemeManifest | string {
  const path = join(themeDir, MANIFEST_FILE)
  if (!isFile(path)) return `${themeDir} has no ${MANIFEST_FILE}: clone takes a theme folder.`
  const text = readFileSync(path, 'utf8')
  let document: unknown
  try {
    document = parsed(text)
  } catch (error) {
    return `${path} can't be read as JSON (${String(error)}).`
  }
  if (!isRecord(document)) return `${path} is not a JSON object.`
  const pages = own(document, PAGES_FIELD)
  if (pages !== undefined && !isRecord(pages)) return `${path}: "${PAGES_FIELD}" is not an object keyed by route.`
  return { text, document }
}

/** The page entry for a clone of `file`, keeping the `keepCorePage` list `previous` had. */
export function clonedPage(previous: unknown, file: CoreFile): JsonRecord {
  const keep = isRecord(previous) ? own(previous, KEEP_FIELD) : undefined
  return {
    mode: CLONE_MODE,
    ...(keep === undefined ? {} : { [KEEP_FIELD]: keep }),
    clonedFrom: { path: file.path, sha: file.sha },
  }
}

/** `text` with `field` added after its last field, laid out as `indent` lays the document out; null with no place. */
function addedAtEnd(text: string, field: string, value: unknown): string | null {
  const close = text.lastIndexOf(OBJECT_CLOSE)
  if (close < 0) return null
  const indent = FIELD_INDENT.exec(text)?.[1] ?? INDENT_STEP
  const body = JSON.stringify(value, null, indent).split('\n').join(`\n${indent}`)
  const before = text.slice(0, close).trimEnd()
  const comma = before.endsWith(OBJECT_OPEN) ? '' : ','
  return `${before}${comma}\n${indent}${JSON.stringify(field)}: ${body}\n${text.slice(close)}`
}

function readsAs(text: string, expected: string): boolean {
  try {
    return JSON.stringify(parsed(text)) === expected
  } catch {
    return false
  }
}

/** theme.json's text with `pages[route]` set to `entry`. */
export function withPage(theme: ThemeManifest, route: string, entry: JsonRecord): string {
  const pages = own(theme.document, PAGES_FIELD)
  const changed = { ...theme.document, [PAGES_FIELD]: { ...(isRecord(pages) ? pages : {}), [route]: entry } }
  const edited = pages === undefined ? addedAtEnd(theme.text, PAGES_FIELD, changed[PAGES_FIELD]) : null
  if (edited !== null && readsAs(edited, JSON.stringify(changed))) return edited
  return `${JSON.stringify(changed, null, INDENT_STEP.length)}\n`
}

/** Writes each file under reference/core/<path>, read-only; returns the paths written, relative to the theme folder. */
export function writeReference(themeDir: string, files: readonly CoreFile[]): string[] {
  return files.map((file) => {
    const relativePath = `${REFERENCE_DIR}/${file.path}`
    const target = join(themeDir, relativePath)
    mkdirSync(dirname(target), { recursive: true })
    // An earlier clone's copy is read-only: removed first, as a new file can always be made in a writable folder.
    rmSync(target, { force: true })
    writeFileSync(target, file.data)
    chmodSync(target, READ_ONLY)
    return relativePath
  })
}

/** Writes theme.json with `pages[route]` the clone of `file`; returns the entry written. */
export function writeClonedPage(themeDir: string, theme: ThemeManifest, route: string, file: CoreFile): JsonRecord {
  const pages = own(theme.document, PAGES_FIELD)
  const entry = clonedPage(isRecord(pages) ? own(pages, route) : undefined, file)
  writeFileSync(join(themeDir, MANIFEST_FILE), withPage(theme, route, entry))
  return entry
}
