/**
 * What HUD's look tests share: the LOOK page and the style sheet as the host mounts lookEditor@1 and styleSheet@1,
 * on the harness's look runtime (host.setLooks), which holds HUD's looks as core's runtime holds them: HUD's own
 * look check (validateHudLook, the spec looks/schema.json is) takes or refuses every look handed in, and ARC is the
 * default a deleted active look goes back to. A test starts on the runtime's state (the user's looks as the host
 * read them, or not read yet) and reads back what the runtime holds (useLook, listLooks); the look's variables are
 * what boot/prepaint.json paints for the held look (lookToCssVars), which the host puts on <html>. After
 * themes/play/test/looks/looks-harness.tsx (Play 1.1.1).
 */
import { listLooks, useLook, type HostLook, type HostLookState } from '@automatos/theme-sdk'
import { host } from '@automatos/theme-harness/host'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { expect, vi, type Mock } from 'vitest'

import { ARC } from '../../src/lib/looks/presets.ts'
import { toHudLook, validateHudLook } from '../../src/lib/looks/spec.ts'
import type { HudLook } from '../../src/lib/looks/types.ts'
import { lookToCssVars } from '../../src/lib/looks/vars.ts'
import { HudLookEditor } from '../../src/slots/look-editor.tsx'
import { HudStyleSheet } from '../../src/slots/style-sheet.tsx'

export const FILES_ROOT = '/api/themes/files/0123abcd/'

/** The look runtime as the host has read it when a test starts. */
export interface LooksStart {
  /** The active look; ARC when left out. */
  readonly look?: HudLook
  readonly saved?: readonly HudLook[]
  /** False while the host is still reading the looks. */
  readonly loaded?: boolean
  /** False once the host can't keep them. */
  readonly persisted?: boolean
}

/** A look runtime holding HUD's looks: HUD's look spec checks each one, and ARC is the default. */
export function mountLooks({ look = ARC, saved = [], loaded = true, persisted = true }: LooksStart = {}): void {
  host.setLooks({ look, saved, loaded, persisted, defaultLook: ARC, check: validateHudLook })
}

let held: HostLookState | null = null

/** Reads the look runtime as HUD's screens do (useLook), so a test can read back what it holds. */
function RuntimeProbe(): null {
  held = useLook()
  return null
}

export function withProbe(tree: ReactNode) {
  return (
    <>
      <RuntimeProbe />
      {tree}
    </>
  )
}

/** Mounts the look runtime with `start`, then renders `tree` on it. */
export function renderOnLooks(tree: ReactNode, start: LooksStart = {}) {
  held = null
  mountLooks(start)
  return render(withProbe(tree))
}

/** The LOOK page as the host mounts HUD's lookEditor@1. */
export const editorTree = () => withProbe(<HudLookEditor />)
export const renderEditor = (start: LooksStart = {}) => renderOnLooks(<HudLookEditor />, start)

/** The active look the runtime holds (the one the host paints), as the last render read it. */
export function heldLook(): HostLook | null {
  return held?.look ?? null
}

export async function lookHeld(look: HudLook = ARC): Promise<void> {
  await waitFor(() => expect(heldLook()).toEqual(look))
}

/** A variable of HUD's (or a Studio token) for the held look, as the host paints it on <html>; '' if it has none. */
export function heldVar(name: string): string {
  const look = heldLook()
  if (look === null) throw new Error('the look runtime holds no look')
  return lookToCssVars(toHudLook(look))[name] ?? ''
}

export const savedLooks = (): readonly HostLook[] => listLooks()

/** jsdom plays no media: play() resolves; Auto's files are served from FILES_ROOT. */
export function startLooksTest(): void {
  host.reset()
  host.setFilesRoot(FILES_ROOT)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
}

/** A saved look of the user's own, as the drawer would have made it. */
export function myLook(fields: Partial<HudLook> = {}): HudLook {
  return { ...ARC, id: 'mine-1', name: 'MINE 1', sub: '', accent: 'gold', ground: 'ember', ...fields }
}

export type User = UserEvent

export const drawer = () => within(screen.getByRole('complementary', { name: 'Edit the look' }))
export const looksRow = () => within(screen.getByRole('region', { name: 'Looks' }))
export const group = (name: string | RegExp) => within(screen.getByRole('group', { name }))
export const share = () => within(screen.getByRole('region', { name: 'Share' }))
export const preview = () => within(screen.getByRole('region', { name: 'Preview' }))

/** The line beside the heading: the active look's name, '· edited' once changed. */
export function statusLine(): HTMLElement {
  const header = screen.getByRole('heading', { level: 1 }).closest('header')
  if (!(header instanceof HTMLElement)) throw new Error('no header around the heading')
  return within(header).getByRole('status')
}

export function card(name: string): HTMLElement {
  return looksRow().getByRole('button', { name })
}

export function slider(name: 'Grid' | 'Glow'): HTMLInputElement {
  return drawer().getByRole('slider', { name }) as HTMLInputElement
}

export function setSlider(name: 'Grid' | 'Glow', value: number): void {
  fireEvent.change(slider(name), { target: { value: String(value) } })
}

export function switchButton(name: 'Scan' | 'Auto' | 'Motion'): HTMLElement {
  return drawer().getByRole('button', { name })
}

export async function press(user: User, control: HTMLElement, key = '{Enter}'): Promise<void> {
  control.focus()
  await user.keyboard(key)
}

export const BLOB_URL = 'blob:automatos/look'

export interface DownloadStub {
  readonly blobs: Blob[]
  readonly downloads: { readonly href: string; readonly download: string }[]
  readonly revoke: Mock
  restore(): void
}

/** jsdom has no object URLs and no downloads: records what Export does instead (Play's stubDownloads). */
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

/** A Blob's text through FileReader (jsdom's Blob may have no text()). */
export function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

/** A button that makes `look` the active one through useLook, as the drawer does from anywhere in the app. */
function Pick({ look }: { readonly look: HudLook }) {
  const { setLook } = useLook()
  return (
    <button type="button" onClick={() => setLook(look)}>
      {`Pick ${look.name}`}
    </button>
  )
}

/** The style sheet as the host mounts HUD's styleSheet@1, beside buttons that change the look. */
export function sheetTree(looks: readonly HudLook[] = []) {
  return (
    <>
      {looks.map((look) => (
        <Pick key={look.id} look={look} />
      ))}
      <HudStyleSheet />
    </>
  )
}

export const renderSheet = (looks: readonly HudLook[] = [], start: LooksStart = {}) => renderOnLooks(sheetTree(looks), start)

export function pick(look: HudLook): void {
  fireEvent.click(screen.getByRole('button', { name: `Pick ${look.name}` }))
}
