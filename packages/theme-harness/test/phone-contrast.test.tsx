// The phone view's contrast panel says what `automatos-theme check` says, measured by check's own measure
// (theme-cli's mobile-contrast measureMobile over the files check reads) for the hello fixture, Play and HUD: the
// outcome, the reason in check's words, and, for each subject the phone can show, its ten pairs with each ratio, its
// minimum and its result. Hello has no mobile block (not measured), Play paints from its looks (each preset in turn),
// HUD gives its own schemes (the one its look's tone shows). Play's look data is the one kit CI's Build step built.
import { MOBILE_CONTRAST_PAIRS } from '@automatos/theme-cli/mobile'
import { measureMobile, subjectLabel, type ContrastSubject, type MobileMeasure } from '@automatos/theme-cli/mobile-contrast'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { NO_BLOCK_TEXT, STATUS_WORDS } from '../app/phone/contrast-panel.tsx'
import { host } from '../src/host.ts'
import { HELLO_DIR, HUD_DIR, NEVER_LOADS, PLAY_DIR, readFolder, renderPhone, servedTheme, type Json } from './phone-support.tsx'

interface Row {
  readonly pair: string
  readonly ratio: string
  readonly minimum: string
  readonly result: string
}

/** The rows of the panel's table, as the panel writes them. */
function panelRows(): Row[] {
  return Array.from(document.querySelectorAll<HTMLTableRowElement>('tr[data-pair]'), (row) => {
    const cells = Array.from(row.cells, (cell) => cell.textContent ?? '')
    return { pair: row.getAttribute('data-pair') ?? '', ratio: cells[1], minimum: cells[2], result: cells[3] }
  })
}

/** A subject's pairs as the panel must write them. */
function rowsOf(subject: ContrastSubject): Row[] {
  return subject.pairs.map((pair) => ({
    pair: `${pair.foreground} on ${pair.background}`,
    ratio: pair.ratio === null ? '–' : `${pair.ratio.toFixed(2)}:1`,
    minimum: `${pair.minimum}:1`,
    result: STATUS_WORDS[pair.status],
  }))
}

/** The panel's outcome and reason are check's. */
function expectVerdict(measure: MobileMeasure): void {
  expect(document.querySelector('[data-outcome]')).toHaveAttribute('data-outcome', measure.status)
  expect(document.querySelector('[data-reason]')?.textContent).toBe(measure.reason)
}

/** The subject the panel's table names, among check's. */
function shownOf(subjects: readonly ContrastSubject[]): ContrastSubject {
  const name = screen.getByRole('table').getAttribute('aria-label') ?? ''
  const subject = subjects.find((entry) => name === `The pairs of ${subjectLabel(entry.kind, entry.id)}`)
  if (subject === undefined) throw new Error(`the panel shows ${name}, which check does not measure`)
  return subject
}

function checked(dir: string) {
  const folder = readFolder(dir)
  const measure = measureMobile(folder.served.manifest as Json, folder.files)
  return { folder, measure, theme: servedTheme(folder.served, NEVER_LOADS) }
}

beforeEach(() => {
  host.reset()
})

describe('the hello fixture', () => {
  it('has no mobile block: check does not measure it, and neither does the panel', () => {
    const { measure, theme } = checked(HELLO_DIR)
    expect(measure).toBeNull()
    renderPhone(theme)
    expect(document.querySelector('[data-outcome]')).toHaveAttribute('data-outcome', 'not_measured')
    expect(screen.getByText(NO_BLOCK_TEXT)).toBeInTheDocument()
    expect(panelRows()).toEqual([])
  })
})

describe('Play', () => {
  const { folder, measure, theme } = checked(PLAY_DIR)

  it("is measured per preset, as check measures it, for each look the phone view shows", () => {
    if (measure === null) throw new Error("Play's theme.json has a mobile block")
    expect([measure.source, theme.presets.length > 0, folder.files.size > 1]).toEqual(['fromLooks', true, true])
    renderPhone(theme)
    expectVerdict(measure)
    theme.presets.forEach((preset) => {
      fireEvent.change(screen.getByLabelText(/^Look/), { target: { value: preset.id } })
      const subject = shownOf(measure.presets ?? [])
      expect([subject.kind, subject.id]).toEqual(['preset', preset.id])
      expect(panelRows()).toEqual(rowsOf(subject))
      expect(panelRows()).toHaveLength(MOBILE_CONTRAST_PAIRS.length)
    })
  })
})

describe('HUD', () => {
  const { measure, theme } = checked(HUD_DIR)

  it('is measured per scheme, as check measures it, for the scheme its look shows', () => {
    if (measure === null) throw new Error("HUD's theme.json has a mobile block")
    expect(measure.source).toBe('tokens')
    renderPhone(theme)
    expectVerdict(measure)
    theme.presets.forEach((preset) => {
      fireEvent.change(screen.getByLabelText(/^Look/), { target: { value: preset.id } })
      const subject = shownOf(measure.schemes ?? [])
      expect(subject.kind).toBe('scheme')
      expect(panelRows()).toEqual(rowsOf(subject))
    })
  })
})
