/**
 * What the style sheet shows: each colour the look paints (by its custom property, as boot/prepaint.json names
 * it), and the type scale app/theme.css sets. The values themselves are read from the page, so the sheet always
 * shows the active look, whichever it is.
 */

export interface Swatch {
  /** The custom property the look paints on <html>. */
  readonly variable: string
  readonly label: string
  /** Where the theme draws it. */
  readonly use: string
}

export const COLOURS: readonly Swatch[] = [
  { variable: '--{{htmlClass}}-bg', label: 'Page', use: 'Behind every page' },
  { variable: '--{{htmlClass}}-surface', label: 'Surface', use: 'The sidebar, cards and panels' },
  { variable: '--{{htmlClass}}-chip', label: 'Chip', use: 'Hover and the current menu item' },
  { variable: '--{{htmlClass}}-line', label: 'Line', use: 'Borders and rules' },
  { variable: '--{{htmlClass}}-text', label: 'Text', use: 'Body text' },
  { variable: '--{{htmlClass}}-text-2', label: 'Quiet text', use: 'Leads, labels and meta' },
  { variable: '--{{htmlClass}}-accent', label: 'Accent', use: 'Filled buttons' },
  { variable: '--{{htmlClass}}-accent-ink', label: 'Accent ink', use: 'Text on a filled button' },
  { variable: '--{{htmlClass}}-accent-text', label: 'Accent text', use: 'Links, the focus ring, the wordmark' },
  { variable: '--{{htmlClass}}-error', label: 'Error', use: 'What went wrong, in words' },
]

export interface TypeSpecimen {
  readonly variable: string
  readonly label: string
  readonly sample: string
}

export const TYPE_SCALE: readonly TypeSpecimen[] = [
  { variable: '--{{htmlClass}}-text-hero', label: 'Hero', sample: 'Make it yours' },
  { variable: '--{{htmlClass}}-text-title', label: 'Title', sample: 'A Deliverable, ready' },
  { variable: '--{{htmlClass}}-text-body', label: 'Body', sample: 'Auto read the brief and drafted the plan.' },
  { variable: '--{{htmlClass}}-text-small', label: 'Small', sample: 'Updated a minute ago' },
  { variable: '--{{htmlClass}}-text-label', label: 'Label', sample: 'OPERATIONS' },
  { variable: '--{{htmlClass}}-text-mono', label: 'Mono', sample: 'agents.run(42)' },
]

/** The look's corners (its Corners knob). */
export const RADIUS_VARIABLE = '--{{htmlClass}}-radius'
