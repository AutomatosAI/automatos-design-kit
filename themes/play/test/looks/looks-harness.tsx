/**
 * PRD-260 T-008a — what the Make it yours and style sheet tests share: Play's screens as the host mounts its
 * lookEditor@1 and styleSheet@1 slots (their chunks loaded), on a look runtime, and the page's regions by role and
 * name.
 *
 * Moved from core's components/looks/__tests__/looks-harness.tsx and rewritten for the kit (PRD-261 B-05e). Core
 * rendered /looks inside builtin Play's LookProvider over localStorage, and read the look back from <html> and the
 * automatos-play.* keys. Here the screens run on the harness's look runtime (host.setLooks), which holds Play's
 * looks as core's runtime holds them for Play: Play's own look spec (validateLook) checks every look handed in, and
 * Ember is the default a deleted active look goes back to. What a test starts on is that runtime's state (the
 * user's looks as the host read them, or not read yet); what it reads back is what the runtime holds (useLook,
 * listLooks), and the look's variables are Play's own for the held look (lookDocumentVars), which the host paints
 * on <html>. Auto's files are the package's (assets/mascot/ under the folder the fake host serves).
 */
import { listLooks, useLook, type HostLook, type HostLookState } from '@automatos/theme-sdk'
import { host } from '@automatos/theme-harness/host'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { expect, vi, type Mock } from 'vitest'

import { LooksScreen } from '../../src/components/looks/looks-screen.tsx'
import { PLAY_STATES } from '../../src/components/looks/style/style-mascots.tsx'
import { StyleScreen } from '../../src/components/looks/style/style-screen.tsx'
import { lookDocumentVars } from '../../src/lib/looks/document.ts'
import { validateLook } from '../../src/lib/looks/engine.ts'
import { AURORA, DAYLIGHT, DEFAULT_LOOK, EMBER } from '../../src/lib/looks/presets.ts'
import { LOOK_FILE_TYPE } from '../../src/lib/looks/transfer.ts'
import type { Look } from '../../src/lib/looks/types.ts'
import { FILES_ROOT } from '../mascot/helpers.ts'

/** The look runtime as the host has read it when a test starts. */
export interface LooksStart {
  /** The active look; Ember when left out. */
  readonly look?: Look
  /** The user's own saved looks. */
  readonly saved?: readonly Look[]
  /** False while the host is still reading the looks (M72). */
  readonly loaded?: boolean
  /** False once the host can't keep them: storage blocked, or a write it refused (M98). */
  readonly persisted?: boolean
}

/** A look runtime holding Play's looks: Play's look spec checks each one, and Ember is the default. */
export function mountLooks({ look = DEFAULT_LOOK, saved = [], loaded = true, persisted = true }: LooksStart = {}): void {
  host.setLooks({ look, saved, loaded, persisted, defaultLook: DEFAULT_LOOK, check: validateLook })
}

/** What the probe last read of the look runtime. */
let held: HostLookState | null = null

/** Reads the look runtime as Play's screens do (useLook), so a test can read back what it holds. */
function RuntimeProbe(): null {
  held = useLook()
  return null
}

/** A slot's screen, as the host renders it, beside the probe. */
export function withProbe(screenTree: ReactNode) {
  return (
    <>
      <RuntimeProbe />
      {screenTree}
    </>
  )
}

/** Make it yours as the host mounts Play's lookEditor@1. */
export const looksTree = () => withProbe(<LooksScreen />)

/** Mounts the look runtime with `start`, then renders `screenTree` on it. */
export function renderOnLooks(screenTree: ReactNode, start: LooksStart = {}) {
  held = null
  mountLooks(start)
  return render(withProbe(screenTree))
}

/** Make it yours on a look runtime started as `start` says. */
export function renderLooks(start: LooksStart = {}) {
  return renderOnLooks(<LooksScreen />, start)
}

/** The active look the runtime holds (the one the host paints), as the last render read it. */
export function heldLook(): HostLook | null {
  return held?.look ?? null
}

/** The runtime holds `look` as the active one: what core read back from <html> once the provider painted it. */
export async function lookHeld(look: Look = EMBER): Promise<void> {
  await waitFor(() => expect(heldLook()).toEqual(look))
}

function requireHeld(): Look {
  const look = heldLook()
  if (look === null) throw new Error('the look runtime holds no look')
  return look as Look
}

/** Play's variable (or Studio's token) for the held look, as the host paints it on <html>; '' if it has none. */
export function heldVar(name: string): string {
  return lookDocumentVars(requireHeld())[name] ?? ''
}

/** The user's saved looks the runtime holds now. */
export const savedLooks = (): readonly HostLook[] => listLooks()

/** The host refused its write after the last change (storage full): from now on it says the looks aren't kept. */
export function refuseLookWrites(): void {
  const look = requireHeld()
  const saved = savedLooks() as readonly Look[]
  act(() => mountLooks({ look, saved, persisted: false }))
}

/** jsdom plays no media: play() resolves; Auto's files are served from FILES_ROOT. */
export function startLooksTest(): void {
  host.reset()
  host.setFilesRoot(FILES_ROOT)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
}

/** A valid saved look of the user's own (core's lib/looks/__tests__/helpers.ts). */
export function myLook(fields: Partial<Look> = {}): Look {
  return { ...EMBER, id: 'my-look-1', name: 'My look 1', sub: 'Saved just now', accent: 'rose', ground: 'indigo', ...fields }
}

/** The line beside the heading: the active look's name, '· edited' once changed. */
export const status = () => screen.getByRole('status')
export const looksRow = () => within(screen.getByRole('region', { name: 'Looks' }))
export const manage = () => within(screen.getByRole('region', { name: 'This look' }))
export const importer = () => within(screen.getByRole('region', { name: 'Import a look' }))
export const group = (name: string | RegExp) => within(screen.getByRole('group', { name }))

/** A card in the Looks row, by the look's name ('Ember Warm, editorial'). */
export function card(name: string): HTMLElement {
  return looksRow().getByRole('button', { name: new RegExp(`^${name}\\b`) })
}

export function pressedCard(): HTMLElement {
  const pressed = looksRow().getAllByRole('button', { pressed: true })
  expect(pressed).toHaveLength(1)
  return pressed[0] as HTMLElement
}

export type User = UserEvent

/** The buttons of 'This look', by their words. */
export function toolbar(): (string | null)[] {
  return manage().getAllByRole('button').map((button) => button.textContent)
}

export const fileInput = () => importer().getByLabelText<HTMLInputElement>('Or choose a .json file')

/** Pastes `text` into 'Import a look' and imports it. */
export async function paste(user: User, text: string): Promise<void> {
  await user.click(importer().getByLabelText("Paste a Look's JSON"))
  await user.paste(text)
  await user.click(importer().getByRole('button', { name: 'Import pasted JSON' }))
}

/** Starts on the user's own 'My look 1' (rose on Night), as the host read it back. */
export async function readyOnMyLook(): Promise<void> {
  renderLooks({ look: myLook(), saved: [myLook()] })
  await waitFor(() => expect(status()).toHaveTextContent(/^My look 1$/))
}

/** Focus a control and press Enter on it, as a keyboard user does. */
export async function press(user: User, control: HTMLElement): Promise<void> {
  control.focus()
  await user.keyboard('{Enter}')
}

export function expectFocusOn(control: HTMLElement): void {
  expect(control).toHaveFocus()
  expect(document.activeElement).not.toBe(document.body)
}

export const BLOB_URL = 'blob:automatos/look'

export interface DownloadStub {
  /** Every Blob Export made a URL for. */
  readonly blobs: Blob[]
  /** Every link Export clicked: its href and file name. */
  readonly downloads: { readonly href: string; readonly download: string }[]
  readonly revoke: Mock
  /** Puts URL's own functions back (the click spy goes with vi.restoreAllMocks). */
  restore(): void
}

/** jsdom implements no object URLs and no downloads: records what Export does instead. */
export function stubDownloads(): DownloadStub {
  const originals = {
    createObjectURL: Object.getOwnPropertyDescriptor(URL, 'createObjectURL'),
    revokeObjectURL: Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL'),
  }
  const blobs: Blob[] = []
  const downloads: { href: string; download: string }[] = []
  const revoke = vi.fn()
  const create = (blob: Blob) => {
    blobs.push(blob)
    return BLOB_URL
  }
  Object.defineProperty(URL, 'createObjectURL', { value: create, configurable: true, writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: revoke, configurable: true, writable: true })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push({ href: this.getAttribute('href') ?? '', download: this.download })
  })
  const restore = () => {
    for (const [name, original] of Object.entries(originals)) {
      if (original) Object.defineProperty(URL, name, original)
      else Reflect.deleteProperty(URL, name)
    }
  }
  return { blobs, downloads, revoke, restore }
}

/** Presses Export: one download of one Blob, a .look.json, whose URL is let go once it has started; its file name. */
export async function exportActive(user: User, stub: DownloadStub): Promise<string> {
  await user.click(manage().getByRole('button', { name: 'Export' }))
  expect(stub.downloads).toHaveLength(1)
  expect(stub.downloads[0]?.href).toBe(BLOB_URL)
  expect(stub.blobs).toHaveLength(1)
  expect(stub.blobs[0]?.type).toBe(LOOK_FILE_TYPE)
  await waitFor(() => expect(stub.revoke).toHaveBeenCalledWith(BLOB_URL), { timeout: 2000 })
  return stub.downloads[0]?.download ?? ''
}

/** A Blob's text through FileReader (jsdom's Blob may have no text()). */
export function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

/** A button that makes `look` the active one through useLook, as Make it yours does. */
function Pick({ look }: { readonly look: Look }) {
  const { setLook } = useLook()
  return (
    <button type="button" onClick={() => setLook(look)}>
      {`Pick ${look.name}`}
    </button>
  )
}

/** The style sheet as the host mounts Play's styleSheet@1, beside two buttons that change the look. */
export const sheetTree = () => (
  <>
    <Pick look={DAYLIGHT} />
    <Pick look={AURORA} />
    <StyleScreen />
  </>
)

/** The style sheet on a look runtime started as `start` says. */
export const renderSheet = (start: LooksStart = {}) => renderOnLooks(sheetTree(), start)

export function pick(look: Look): void {
  fireEvent.click(screen.getByRole('button', { name: `Pick ${look.name}` }))
}

function rowFor(label: string): HTMLElement {
  const row = screen.getByRole('rowheader', { name: label }).closest('tr')
  if (!row) throw new Error(`no row for ${label}`)
  return row
}

/** The ratio shown in the contrast table's row for a pair, e.g. "text / bg". */
export function ratioFor(label: string): number {
  return Number.parseFloat(within(rowFor(label)).getByText(/^\d+\.\d{2}:1$/).textContent ?? '')
}

export function verdictFor(label: string): string {
  return within(rowFor(label)).getByText(/AA (pass|fail)/).textContent ?? ''
}

/** The swatch for a look variable, e.g. "--pl-ground-bg": its chip, name, value, role and note. */
export function swatchItem(name: string): HTMLElement {
  const item = screen.getByText(name).closest('li')
  if (!item) throw new Error(`no swatch ${name}`)
  return item
}

export function swatchValue(name: string): string {
  return swatchItem(name).children[2]?.textContent ?? ''
}

/** The colour a swatch's chip is drawn in: the --pl-look-swatch swatch-style.ts's colourStyle sets. */
export function chipColour(name: string): string {
  const chip = swatchItem(name).children[0]
  if (!(chip instanceof HTMLElement)) throw new Error(`no chip for ${name}`)
  return chip.style.getPropertyValue('--pl-look-swatch')
}

/** The inline custom property each item's drawn specimen carries, in a scale section. */
export function specimenValues(section: string, property: string): string[] {
  const items = within(screen.getByRole('region', { name: section })).getAllByRole('listitem')
  return items.map((item) => {
    const specimen = item.firstElementChild
    return specimen instanceof HTMLElement ? specimen.style.getPropertyValue(property) : ''
  })
}

const MASCOT_REGION = /^Mascot slot/
export const mascotRegion = () => screen.getByRole('region', { name: MASCOT_REGION })
export const playStates = () => within(mascotRegion()).getByRole('button', { name: PLAY_STATES })
export const stillsIn = (region: HTMLElement) => Array.from(region.querySelectorAll('img'))
export const clipsIn = (region: HTMLElement) => Array.from(region.querySelectorAll('video'))

/** jsdom's navigator.clipboard as this file found it. */
const clipboardAtStart = Object.getOwnPropertyDescriptor(window.navigator, 'clipboard')

export function stubClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText } })
}

export function restoreClipboard(): void {
  if (clipboardAtStart) Object.defineProperty(window.navigator, 'clipboard', clipboardAtStart)
  else Reflect.deleteProperty(window.navigator, 'clipboard')
}
