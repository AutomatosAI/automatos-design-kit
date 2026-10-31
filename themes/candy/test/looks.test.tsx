// Candy's look editor (lookEditor@1, the host's /looks) on the kit's harness, through the host's look runtime: a
// preset picked goes to the host and its card shows as picked; each kind of knob (a choice, a slider, the Motion
// switch) changes the active look at once, and Reduce Motion turns the switch off for good; Save look keeps a preset
// as a new look (Auto celebrates, then settles) or saves a saved look over itself; Reset goes back to the palette's
// preset; Export downloads the look and Import adds a pasted one, each refusal in the host's words; a saved look can
// be picked, renamed and deleted. Until the looks load the page is its heading alone; outside a runtime it says so.
import { listLooks, useLook, type HostLook, type HostLookResult } from '@automatos/theme-sdk'
import { host } from '@automatos/theme-harness/host'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MOTION_ON, MOTION_PAUSED, MOTION_REDUCED } from '../src/looks/look-controls.tsx'
import { CELEBRATE_MS, EDITOR_REGION, LookEditor, NO_RUNTIME, NOT_KEPT, STYLE_SHEET_LINK } from '../src/looks/look-editor.tsx'
import { nameFieldLabel, SAVE_NAME } from '../src/looks/look-presets.tsx'
import { PREVIEW_HEADING } from '../src/looks/look-preview.tsx'
import { ADD_LOOK, EXPORT_LOOK, IMPORT_LABEL, IMPORT_LOOK, NOT_DONE, RESET, SAVE_LOOK, SAVED } from '../src/looks/look-transfer.tsx'
import { DEFAULT_LOOK, GRADIENT_NOTES, KNOBS, LOOK_SCHEMA, PRESETS, type ThemeLook } from '../src/looks/spec.ts'

const NOT_A_LOOK = 'That is not a look of Candy.'
const [BLUSH, LILAC, NIGHTBLOOM] = PRESETS
const MINE: ThemeLook = { ...BLUSH, id: 'mine-1', name: 'My look 1', sub: 'From Blush', roundness: '36' }

/** The host's look check, as it makes it from looks/schema.json: the schema, a name, and a value each knob takes. */
function fitsKnob(knob: (typeof KNOBS)[number], value: unknown): boolean {
  if (knob.kind === 'choice') return knob.choices.some((choice) => choice.key === value)
  return typeof value === 'number' && Number.isInteger(value) && value >= knob.min && value <= knob.max
}

function checkLook(look: unknown): HostLookResult {
  const fields = (look ?? {}) as Readonly<Record<string, unknown>>
  const named = typeof fields.id === 'string' && typeof fields.sub === 'string' && typeof fields.name === 'string' && fields.name.trim() !== ''
  const fits = KNOBS.every((knob) => fitsKnob(knob, fields[knob.name]))
  if (!named || !fits || fields.schema !== LOOK_SCHEMA) return { ok: false, errors: [NOT_A_LOOK] }
  return { ok: true, look: { ...(look as ThemeLook) } }
}

/** The look the host has active now, as the rest of the app reads it. */
let active: HostLook | null = null
function ActiveLook() {
  active = useLook().look
  return null
}
const activeLook = (): ThemeLook => active as ThemeLook

interface Mount {
  readonly look?: ThemeLook
  readonly saved?: readonly ThemeLook[]
  readonly check?: (look: unknown) => HostLookResult
  readonly loaded?: boolean
  readonly persisted?: boolean
}

function mount({ look = DEFAULT_LOOK, saved = [], check = checkLook, loaded, persisted }: Mount = {}) {
  host.setLooks({ look, defaultLook: DEFAULT_LOOK, saved, check, loaded, persisted })
  return render(
    <>
      <LookEditor />
      <ActiveLook />
    </>,
  )
}

const preset = (name: string): HTMLElement => screen.getByRole('button', { name: new RegExp(`^${name}`) })
const group = (name: string): HTMLElement => screen.getByRole('radiogroup', { name })
const click = (name: string): void => {
  fireEvent.click(screen.getByRole('button', { name }))
}
const previewAuto = (): Element | null => screen.getByRole('region', { name: PREVIEW_HEADING }).querySelector('svg[data-state]')

beforeEach(() => {
  host.reset()
  active = null
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the look editor', () => {
  it('shows its heading alone, and is busy, until the looks have loaded', () => {
    const { container } = mount({ loaded: false })
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('data-theme-heading')
    expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('region', { name: EDITOR_REGION })).not.toBeInTheDocument()
  })

  it('links to the style sheet once loaded', () => {
    mount()
    expect(screen.getByRole('link', { name: STYLE_SHEET_LINK })).toHaveAttribute('href', '/looks/style')
  })

  it('says nothing is kept outside a look runtime', () => {
    render(<LookEditor />)
    expect(screen.getByText(NO_RUNTIME)).toBeInTheDocument()
  })

  it("says so when this browser isn't keeping looks", () => {
    mount({ persisted: false })
    expect(screen.getByText(NOT_KEPT)).toBeInTheDocument()
  })
})

describe('the presets', () => {
  it('picks a preset: the host takes that look, and the picked card moves', () => {
    mount()
    expect(preset('Blush')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(preset('Lilac'))
    expect(activeLook()).toEqual(LILAC)
    expect([preset('Blush'), preset('Lilac'), preset('Night bloom')].map((card) => card.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
    ])
    expect(within(group('Palette')).getByRole('radio', { name: 'Lilac' })).toBeChecked()
  })
})

describe('the knobs', () => {
  it('changes a choice knob at once, keeping the others', () => {
    mount()
    fireEvent.click(within(group('Palette')).getByRole('radio', { name: 'Night bloom' }))
    expect(activeLook()).toEqual({ ...BLUSH, palette: 'nightbloom' })
    expect(preset('Night bloom')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(group('Card colours')).getByRole('radio', { name: 'One colour' }))
    expect(activeLook().cards).toBe('single')
    expect(within(group('Card colours')).getByRole('radio', { name: 'One colour' })).toBeChecked()
  })

  it("shows the gradient's note beside it", () => {
    mount()
    expect(group('Gradient')).toHaveAccessibleDescription(GRADIENT_NOTES.rich)
    fireEvent.click(within(group('Gradient')).getByRole('radio', { name: 'Vivid' }))
    expect(activeLook().gradient).toBe('vivid')
    expect(group('Gradient')).toHaveAccessibleDescription(GRADIENT_NOTES.vivid)
  })

  it('changes a slider knob to a whole number, with its value beside it', () => {
    mount()
    const roundness = screen.getByRole('slider', { name: 'Roundness' })
    fireEvent.change(roundness, { target: { value: '36' } })
    expect(activeLook().roundness).toBe('36')
    expect(roundness).toHaveAttribute('aria-valuetext', '36 px')
    expect(screen.getByText('36 px')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('slider', { name: 'Glow' }), { target: { value: '9' } })
    expect(activeLook().glow).toBe(9)
  })

  it('pauses and resumes motion with the switch', () => {
    mount()
    const motion = screen.getByRole('switch', { name: 'Motion' })
    expect(motion).toHaveAttribute('aria-checked', 'true')
    expect(motion).toHaveAccessibleDescription(MOTION_ON)
    fireEvent.click(motion)
    expect(activeLook().motion).toBe('paused')
    expect(motion).toHaveAttribute('aria-checked', 'false')
    expect(motion).toHaveAccessibleDescription(MOTION_PAUSED)
    fireEvent.click(motion)
    expect(activeLook().motion).toBe('on')
  })

  it('under Reduce Motion: motion is off and the switch is disabled', () => {
    host.setReducedMotion(true)
    mount()
    const motion = screen.getByRole('switch', { name: 'Motion' })
    expect(motion).toBeDisabled()
    expect(motion).toHaveAttribute('aria-checked', 'false')
    expect(motion).toHaveAccessibleDescription(MOTION_REDUCED)
  })
})

describe('Save look and Reset', () => {
  it('keeps a preset as a new look, makes it active, and Auto celebrates for a moment', () => {
    vi.useFakeTimers()
    mount()
    click(SAVE_LOOK)
    expect(listLooks().map((look) => [look.id, look.name])).toEqual([['mine-1', 'My look 1']])
    expect(activeLook().id).toBe('mine-1')
    expect(screen.getByRole('status')).toHaveTextContent('Saved as My look 1.')
    expect(screen.getByRole('button', { name: SAVED })).toBeInTheDocument()
    expect(previewAuto()).toHaveAttribute('data-state', 'celebrate')
    act(() => vi.advanceTimersByTime(CELEBRATE_MS))
    expect(screen.getByRole('button', { name: SAVE_LOOK })).toBeInTheDocument()
    expect(previewAuto()).toHaveAttribute('data-state', 'idle')
  })

  it('saves a saved look over itself', () => {
    mount({ look: MINE, saved: [MINE] })
    fireEvent.change(screen.getByRole('slider', { name: 'Glow' }), { target: { value: '2' } })
    click(SAVE_LOOK)
    expect(listLooks()).toEqual([{ ...MINE, glow: 2 }])
    expect(screen.getByRole('status')).toHaveTextContent('Saved My look 1.')
  })

  it("goes back to the palette's preset", () => {
    mount({ look: { ...LILAC, roundness: '20', glow: 1, motion: 'paused' } })
    click(RESET)
    expect(activeLook()).toEqual(LILAC)
    expect(screen.getByRole('status')).toHaveTextContent('Back to Lilac.')
  })

  it("shows the host's reasons when it refuses a save", () => {
    mount({ check: () => ({ ok: false, errors: [NOT_A_LOOK] }) })
    click(SAVE_LOOK)
    expect(screen.getByRole('alert')).toHaveTextContent(`${NOT_DONE}${NOT_A_LOOK}`)
    expect(screen.getByRole('button', { name: SAVE_LOOK })).toBeInTheDocument()
  })
})

describe('Export and Import', () => {
  it('downloads the active look as a .look.json file', () => {
    const createObjectURL = vi.fn((blob: Blob) => `blob:${blob.type}`)
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
    const downloads: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download)
    })
    mount({ look: NIGHTBLOOM })
    click(EXPORT_LOOK)
    expect(downloads).toEqual(['nightbloom.look.json'])
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('The download of nightbloom.look.json has started.')
  })

  it("refuses to export a look the theme's checks refuse", () => {
    mount({ check: () => ({ ok: false, errors: [NOT_A_LOOK] }) })
    click(EXPORT_LOOK)
    expect(screen.getByRole('alert')).toHaveTextContent("Blush can't be exported")
  })

  it('adds a pasted look, makes it active and closes the box', () => {
    mount()
    const toggle = screen.getByRole('button', { name: IMPORT_LOOK })
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.change(screen.getByLabelText(IMPORT_LABEL), { target: { value: JSON.stringify({ ...NIGHTBLOOM, name: 'Late night' }) } })
    click(ADD_LOOK)
    expect(listLooks().map((look) => [look.id, look.name])).toEqual([['imported-1', 'Late night']])
    expect(activeLook().name).toBe('Late night')
    expect(screen.getByRole('status')).toHaveTextContent('Added Late night.')
    expect(screen.queryByLabelText(IMPORT_LABEL)).not.toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it("shows a refused import in the host's words, and adds nothing", () => {
    mount()
    click(IMPORT_LOOK)
    fireEvent.change(screen.getByLabelText(IMPORT_LABEL), { target: { value: 'not a look' } })
    click(ADD_LOOK)
    expect(screen.getByRole('alert')).toHaveTextContent(NOT_A_LOOK)
    expect(listLooks()).toEqual([])
    expect(screen.getByLabelText(IMPORT_LABEL)).toHaveValue('not a look')
  })
})

describe('saved looks', () => {
  it('picks, renames and deletes a saved look', () => {
    mount({ saved: [MINE] })
    const pick = screen.getByRole('button', { name: MINE.name })
    expect(pick).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(pick)
    expect(activeLook()).toEqual(MINE)
    expect(screen.getByRole('button', { name: MINE.name })).toHaveAttribute('aria-pressed', 'true')
    click(`Rename ${MINE.name}`)
    fireEvent.change(screen.getByLabelText(nameFieldLabel(MINE.name)), { target: { value: '  Pink party ' } })
    click(SAVE_NAME)
    expect(listLooks().map((look) => look.name)).toEqual(['Pink party'])
    expect(screen.getByRole('status')).toHaveTextContent('Renamed to Pink party.')
    click('Delete Pink party')
    expect(listLooks()).toEqual([])
    expect(activeLook()).toEqual(DEFAULT_LOOK)
    expect(screen.getByRole('status')).toHaveTextContent('Deleted Pink party.')
  })

  it('keeps the name box open, with the reasons, when the host refuses a name', () => {
    mount({ saved: [MINE] })
    click(`Rename ${MINE.name}`)
    fireEvent.change(screen.getByLabelText(nameFieldLabel(MINE.name)), { target: { value: '   ' } })
    click(SAVE_NAME)
    expect(screen.getByRole('alert')).toHaveTextContent(NOT_A_LOOK)
    expect(screen.getByLabelText(nameFieldLabel(MINE.name))).toBeInTheDocument()
    expect(listLooks().map((look) => look.name)).toEqual([MINE.name])
  })
})
