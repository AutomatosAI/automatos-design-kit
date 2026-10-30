/**
 * What the phone view's tests share: made-up themes with a `mobile` block (checked by core's validator, as the
 * harness page checks them), a theme folder read both as the harness's build serves it and as `check` reads it, the
 * phone view drawn as app/main.tsx draws it, and a colour as the DOM writes it back, so a part's colour is compared
 * with the colour the paint gave it whatever form jsdom keeps it in.
 */
import { defineTheme } from '@automatos/theme-sdk'
import { render } from '@testing-library/react'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ReactNode } from 'react'
import { PhonePage } from '../app/phone/page.tsx'
import { readServedTheme, type HarnessTheme, type ServedFiles } from '../src/host/register.ts'
import { PREPAINT_PATH, PRESETS_DIR, PRESET_SUFFIX } from '../src/phone/contrast.ts'
import type { PaintSlot } from '../src/phone/parts.ts'
import { DEFAULT_PHONE_SETTINGS, type PhoneSettings } from '../src/phone/settings.ts'

export type Json = Readonly<Record<string, unknown>>

// From the string import.meta.url: under jsdom, `new URL()` is jsdom's class, which fileURLToPath refuses.
const KIT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
export const HELLO_DIR = join(KIT_DIR, 'packages/theme-cli/test/fixtures/core/hello')
export const PLAY_DIR = join(KIT_DIR, 'themes/play')
export const HUD_DIR = join(KIT_DIR, 'themes/hud')
export const ARCADE_DIR = join(KIT_DIR, 'themes/arcade')

/** A theme.json core accepts, for a made-up theme with this `mobile` block (null: none). */
export function skinManifest(mobile: Json | null, changes: Json = {}): Json {
  return {
    schema: 'automatos-theme/v1', id: 'example/skin', name: 'Skin sample', version: '1.0.0',
    engines: { automatos: '^1.1.0', sdk: '^1.1.0' }, base: 'studio', htmlClass: 'skin', minWidth: 1024, tone: 'user',
    slots: ['frame@1', 'lookEditor@1', 'styleSheet@1'], ...(mobile === null ? {} : { mobile }), ...changes,
  }
}

function SampleFrame({ children }: { readonly children?: ReactNode }) {
  return <div data-testid="frame">{children}</div>
}

const sampleEntry = (): Promise<unknown> => Promise.resolve({
  default: defineTheme({ register: (host) => host.registerSlot('frame@1', SampleFrame) }),
})

/** The served files checked as the harness page checks them; a throw naming what core would refuse. */
export function servedTheme(files: ServedFiles, loadEntry: () => Promise<unknown> = sampleEntry): HarnessTheme {
  const served = readServedTheme(files, loadEntry)
  if (!served.ok) throw new Error(served.errors.join('\n'))
  return served.theme
}

/** An entry that never loads: a built-in theme's host draws nothing, which the contrast panel does not need. */
export const NEVER_LOADS = (): Promise<unknown> => new Promise(() => undefined)

export interface ThemeFolder {
  /** As vite.harness.config.ts serves the folder: theme.json, its presets in file-name order, its prepaint table. */
  readonly served: ServedFiles
  /** As `check` reads the package: each preset and the table by path, as bytes. */
  readonly files: ReadonlyMap<string, Uint8Array>
}

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'))

/** A theme folder as the harness serves it and as `check` reads it (its look data built, as kit CI's Build builds it). */
export function readFolder(dir: string): ThemeFolder {
  const presetsDir = join(dir, PRESETS_DIR)
  const names = existsSync(presetsDir) ? readdirSync(presetsDir).filter((name) => name.endsWith(PRESET_SUFFIX)).sort() : []
  const prepaintPath = join(dir, PREPAINT_PATH)
  const served: ServedFiles = {
    manifest: readJson(join(dir, 'theme.json')),
    presets: names.map((name) => readJson(join(presetsDir, name))),
    prepaint: existsSync(prepaintPath) ? readJson(prepaintPath) : null,
  }
  const bytes = (path: string): Uint8Array => new Uint8Array(readFileSync(path))
  const files = new Map<string, Uint8Array>([
    ...names.map((name): [string, Uint8Array] => [`${PRESETS_DIR}${name}`, bytes(join(presetsDir, name))]),
    ...(existsSync(prepaintPath) ? [[PREPAINT_PATH, bytes(prepaintPath)] as [string, Uint8Array]] : []),
  ])
  return { served, files }
}

/** The phone view as app/main.tsx starts it on PHONE_PATH. */
export function renderPhone(theme: HarnessTheme, assets: readonly string[] = [], changes: Partial<PhoneSettings> = {}) {
  const settings: PhoneSettings = { ...DEFAULT_PHONE_SETTINGS, ...changes }
  return render(<PhonePage theme={theme} assets={assets} initial={settings} />)
}

/** A colour as the DOM writes it back, so two forms of one colour compare equal. */
export function cssColour(colour: string): string {
  const probe = document.createElement('i')
  probe.style.color = colour
  return probe.style.color
}

const SLOT_PROPERTIES: Readonly<Record<PaintSlot, string>> = Object.freeze({
  backgroundColor: 'background-color',
  borderColor: 'border-top-color',
  borderTopColor: 'border-top-color',
  borderBottomColor: 'border-bottom-color',
  color: 'color',
})

/** The colour an element's own style gives a paint slot, as the DOM writes it back. */
export function slotColour(element: HTMLElement, slot: PaintSlot): string {
  return element.style.getPropertyValue(SLOT_PROPERTIES[slot])
}

/** Every element drawn as the part. */
export function partsNamed(part: string, root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`[data-go-part="${part}"]`))
}
