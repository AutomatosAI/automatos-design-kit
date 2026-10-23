/**
 * The seeded theme of the `check design` tests (check-design.test.ts): core's hello theme with a
 * prepaint table (hex variables, Studio triplets and an hsl()-wrapped triplet on each ground, a pair
 * table, and a numeric rule whose value is an rgba(), not a colour) and a design/contrast.json whose
 * pairs all read, changed one way per test.
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DESIGN_CONTRAST_PATH, DESIGN_CONTRAST_SCHEMA } from '../src/check/design.ts'
import { PREPAINT_PATH } from '../src/core/css-value.ts'
import type { PackageEntry } from '../src/members.ts'
import { HELLO_DIR, tempFolder } from './check-support.ts'
import { folderFiles } from './hello-files.ts'

export type Json = Readonly<Record<string, unknown>>

const GROUNDS = {
  paper: { '--hello-bg': '#FFFFFF', '--hello-text': '#1F1F1F', '--background': '0 0% 100%', '--foreground': '0 0% 12%', '--fg': 'hsl(0 0% 12%)' },
  ink: { '--hello-bg': '#111111', '--hello-text': '#EEEEEE', '--background': '0 0% 7%', '--foreground': '0 0% 93%', '--fg': 'hsl(0 0% 93%)' },
}
const LINKS = {
  paper: { blue: { '--hello-link': '#1D4ED8' }, green: { '--hello-link': '#1E7F3C' } },
  ink: { blue: { '--hello-link': '#6B8CFF' }, green: { '--hello-link': '#2E9E52' } },
}
export const GLOW = {
  var: '--hello-glow', knob: 'radius', min: 0, max: 16, integer: true, scale: 100, capTable: null, caps: null,
  color: { knob: 'accent', rgb: { blue: '29,78,216', green: '30,127,60' } }, template: 'rgba-alpha',
}
export const TABLE = {
  knobs: { ground: GROUNDS, accent: { blue: { '--hello-accent': '#1D4ED8' }, green: { '--hello-accent': '#1E7F3C' } } },
  pairs: [{ a: 'ground', b: 'accent', table: LINKS }],
  numeric: [GLOW],
  defaults: { ground: 'paper', accent: 'blue', radius: 6 },
}
/** Each reads on both presets: hex, triplets, a wrapped triplet, a pair table's variable, and #1E7F3C on #111111 (3.74:1) at 3. */
export const PASSING = [
  { text: '--hello-text', ground: '--hello-bg' },
  { text: '--foreground', ground: '--background' },
  { text: '--fg', ground: '--background' },
  { text: '--hello-link', ground: '--hello-bg' },
  { text: '--hello-accent', ground: '--hello-bg', min: 3 },
]
export const contrastFile = (pairs: readonly unknown[]): Json => ({ schema: DESIGN_CONTRAST_SCHEMA, pairs })
/** --hello-accent on --hello-bg at the default 4.5: #1D4ED8 on #FFFFFF reads (6.70:1), #1E7F3C on #111111 doesn't (3.74:1). */
export const ACCENT_ON_BG = contrastFile([{ text: '--hello-accent', ground: '--hello-bg' }])

/** Files set (any JSON value, written as JSON) or, with null, dropped, over hello's looks with TABLE and PASSING. */
export type Change = Readonly<Record<string, unknown>>

function designFiles(change: Change = {}): Map<string, string> {
  const looks = Array.from(folderFiles(HELLO_DIR)).filter(([path]) => path.startsWith('looks/'))
  const base: Array<[string, unknown]> = [
    ...looks.map(([path, data]): [string, unknown] => [path, JSON.parse(new TextDecoder().decode(data))]),
    [PREPAINT_PATH, TABLE], [DESIGN_CONTRAST_PATH, contrastFile(PASSING)],
  ]
  const all = Object.entries(Object.fromEntries([...base, ...Object.entries(change)]))
  return new Map(all.filter(([, value]) => value !== null).map(([path, value]) => [path, `${JSON.stringify(value, null, 2)}\n`]))
}

/** The design files with `change`, as `check design` reads them from a folder. */
export function entriesOf(change: Change = {}): PackageEntry[] {
  return Array.from(designFiles(change), ([path, text]) => ({ path, data: new TextEncoder().encode(text) }))
}

/** A copy of the hello theme folder with the design files written in. */
export function designFolder(change: Change = {}): string {
  const theme = join(tempFolder(), 'hello')
  cpSync(HELLO_DIR, theme, { recursive: true })
  rmSync(join(theme, 'looks'), { recursive: true, force: true })
  designFiles(change).forEach((text, path) => {
    mkdirSync(dirname(join(theme, path)), { recursive: true })
    writeFileSync(join(theme, path), text)
  })
  return theme
}
