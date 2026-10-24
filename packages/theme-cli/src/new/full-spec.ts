/**
 * templates/full/template.json read and checked (PRD-261 B-03f): what the full template takes from Play, what it adds,
 * how it renames, and what `--mascot none` leaves out. It is the kit's own file, so a malformed one is a bug: reading
 * it throws, naming the field.
 *
 * - `from`, `copy`: Play's folder in the kit and the paths taken from it (files, or folders taken whole).
 * - `code`: a folder of files in Play's own words (its `--pl-*` variables, its component names), added to the copy
 *   before the renames and renamed with it. `files`: the new theme's own files (its README, CHANGELOG, NOTICE),
 *   added after, with their placeholders filled and never renamed.
 * - `keep`, `renames`: rename.ts's spec. `patches`: text inserted into Play's files, each after the one place its
 *   `after` text stands, before the renames.
 * - `pages`, `uses`: theme.json entries the template adds (B-01f's cloned page and its SDK area).
 * - `noMascot`: what `--mascot none` drops, the code it puts in place of Auto's drawing, the package it no longer
 *   bundles, and that package's modules it copies into the theme instead (the chat's captions read them).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RenameRule, RenameSpec } from './rename.ts'

export const FULL_TEMPLATE_FILE = 'template.json'

export interface Patch {
  readonly path: string
  readonly after: string
  readonly insert: string
}

export interface Vendor {
  readonly from: string
  readonly to: string
  readonly modules: readonly string[]
}

export interface NoMascot {
  readonly drop: readonly string[]
  readonly code: string
  readonly package: string
  readonly vendor: Vendor
}

export interface FullTemplate extends RenameSpec {
  readonly from: string
  readonly copy: readonly string[]
  readonly code: string
  readonly files: string
  readonly placeholders: readonly string[]
  readonly patches: readonly Patch[]
  readonly pages: Readonly<Record<string, unknown>>
  readonly uses: readonly string[]
  readonly noMascot: NoMascot
}

type Json = Readonly<Record<string, unknown>>

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(field: string, wants: string): never {
  throw new Error(`templates/full/${FULL_TEMPLATE_FILE}: "${field}" must be ${wants}.`)
}

function text(record: Json, field: string, where = field): string {
  const value = record[field]
  return typeof value === 'string' && value !== '' ? value : fail(where, 'a non-empty string')
}

function texts(record: Json, field: string, where = field): string[] {
  const value = record[field]
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : fail(where, 'a list of strings')
}

function records(record: Json, field: string): Json[] {
  const value = record[field]
  return Array.isArray(value) && value.every(isRecord) ? value : fail(field, 'a list of objects')
}

/** A rule's pattern compiles and captures nothing, so rename.ts can tell the rules apart by their groups. */
function rule(entry: Json, index: number): RenameRule {
  const where = `renames[${index}]`
  const pattern = text(entry, 'pattern', `${where}.pattern`)
  let groups: number
  try {
    groups = (new RegExp(`${pattern}|`).exec('') ?? []).length - 1
  } catch {
    return fail(`${where}.pattern`, 'a regular expression')
  }
  if (groups !== 0) fail(`${where}.pattern`, 'a regular expression with no capture group')
  const identifier = entry.identifier === undefined ? undefined : entry.identifier === true
  return { pattern, to: text(entry, 'to', `${where}.to`), ...(identifier === undefined ? {} : { identifier }) }
}

function patch(entry: Json, index: number): Patch {
  const where = `patches[${index}]`
  return { path: text(entry, 'path', `${where}.path`), after: text(entry, 'after', `${where}.after`), insert: text(entry, 'insert', `${where}.insert`) }
}

function noMascot(value: unknown): NoMascot {
  if (!isRecord(value)) return fail('noMascot', 'an object')
  const vendor = value.vendor
  if (!isRecord(vendor)) return fail('noMascot.vendor', 'an object')
  return {
    drop: texts(value, 'drop', 'noMascot.drop'),
    code: text(value, 'code', 'noMascot.code'),
    package: text(value, 'package', 'noMascot.package'),
    vendor: {
      from: text(vendor, 'from', 'noMascot.vendor.from'),
      to: text(vendor, 'to', 'noMascot.vendor.to'),
      modules: texts(vendor, 'modules', 'noMascot.vendor.modules'),
    },
  }
}

/** The full template's description from its folder. */
export function readFullTemplate(templateDir: string): FullTemplate {
  const document: unknown = JSON.parse(readFileSync(join(templateDir, FULL_TEMPLATE_FILE), 'utf8'))
  if (!isRecord(document)) return fail('(the file)', 'a JSON object')
  const pages = document.pages
  return {
    from: text(document, 'from'),
    copy: texts(document, 'copy'),
    code: text(document, 'code'),
    files: text(document, 'files'),
    placeholders: texts(document, 'placeholders'),
    keep: texts(document, 'keep'),
    renames: records(document, 'renames').map(rule),
    patches: records(document, 'patches').map(patch),
    pages: isRecord(pages) ? pages : fail('pages', 'an object'),
    uses: texts(document, 'uses'),
    noMascot: noMascot(document.noMascot),
  }
}
