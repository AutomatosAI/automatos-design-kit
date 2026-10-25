/**
 * PRD-261 B-02e: the harness's toolbar: which view (a slot, page or route the theme serves, at its path), which of
 * the theme's presets, the stage's width (the window's, 1440, 1024, a phone's 390, or just below the theme's minWidth,
 * where the host draws its own pages), the tone (off while the theme or its look forces one, as core forces it),
 * reduced motion, forced colours, and the transcript (the chat opened on a made-up exchange, src/host/transcript.ts).
 * Every control is a labelled native one. Below them, what theme.json declares that the theme didn't register, and
 * what it registered undeclared (the host draws neither). A link opens the phone view (app/phone/page.tsx), what
 * Automatos Go draws for the theme.
 */
import type { HostLook } from '@automatos/theme-sdk'
import type { ChangeEvent, CSSProperties } from 'react'
import type { RegisterReport } from '../src/host/register.ts'
import { PHONE_PATH, WINDOW_WIDTH, widthChoices, type HarnessSettings, type HarnessTone, type View } from '../src/host/router.ts'

export interface ToolbarProps {
  readonly settings: HarnessSettings
  /** The fake host's path now (the theme's links move it too). */
  readonly path: string
  readonly views: readonly View[]
  readonly presets: readonly HostLook[]
  readonly minWidth: number
  /** The tone the theme forces now; null while the user's choice holds. */
  readonly forcedTone: HarnessTone | null
  readonly report: RegisterReport | null
  readonly onChange: (next: HarnessSettings) => void
  readonly onPath: (path: string) => void
}

interface Option {
  readonly value: string
  readonly label: string
}

const BAR_STYLE: CSSProperties = Object.freeze({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '12px 20px',
  padding: '8px 16px',
  background: '#f4f4f5',
  color: '#18181b',
  borderBottom: '1px solid #a1a1aa',
  fontFamily: 'system-ui, sans-serif',
  fontSize: '14px',
})
const FIELD_STYLE: CSSProperties = Object.freeze({ display: 'inline-flex', alignItems: 'center', gap: '6px' })
/** The page draws on core's base layer (no border, no padding on a select), so the toolbar's own controls say theirs. */
const SELECT_STYLE: CSSProperties = Object.freeze({ border: '1px solid #71717a', borderRadius: '4px', padding: '2px 6px', background: '#ffffff' })
const LINK_STYLE: CSSProperties = Object.freeze({ color: '#1d4ed8', textDecoration: 'underline' })
const KIND_LABELS: Readonly<Record<View['kind'], string>> = Object.freeze({ slot: 'slot', page: 'page', route: 'route', base: 'host page' })

function SelectField(props: { label: string; value: string; options: readonly Option[]; disabled?: boolean; onSelect: (value: string) => void }) {
  const { label, value, options, disabled = false, onSelect } = props
  return (
    <label style={FIELD_STYLE}>
      {label}
      <select value={value} disabled={disabled} style={SELECT_STYLE} onChange={(event: ChangeEvent<HTMLSelectElement>) => onSelect(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function CheckField(props: { label: string; checked: boolean; onToggle: (checked: boolean) => void }) {
  return (
    <label style={FIELD_STYLE}>
      <input type="checkbox" checked={props.checked} onChange={(event: ChangeEvent<HTMLInputElement>) => props.onToggle(event.target.checked)} />
      {props.label}
    </label>
  )
}

/** Every view, and the path now when it is none of them (a host page the theme linked to). */
function viewOptions(views: readonly View[], path: string): Option[] {
  const options = views.map((view) => ({ value: view.path, label: `${KIND_LABELS[view.kind]}: ${view.key}` }))
  return views.some((view) => view.path === path) ? options : [...options, { value: path, label: `${KIND_LABELS.base}: ${path}` }]
}

function widthOptions(minWidth: number, width: number | null): Option[] {
  const options = widthChoices(minWidth).map((choice) => ({ value: choice.value, label: choice.label }))
  const value = width === null ? WINDOW_WIDTH : String(width)
  return options.some((option) => option.value === value) ? options : [...options, { value, label: `${value} px` }]
}

function widthOf(value: string): number | null {
  return value === WINDOW_WIDTH ? null : Number(value)
}

const TONE_OPTIONS: readonly Option[] = Object.freeze([{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }])

/** The report's two lines, or none when the theme registered exactly what theme.json declares. */
function ReportLines({ report }: { report: RegisterReport | null }) {
  if (report === null) return null
  const missing = [...report.missing.slots, ...report.missing.pages, ...report.missing.routes].join(', ')
  const undeclared = [...report.undeclared.slots, ...report.undeclared.pages, ...report.undeclared.routes].join(', ')
  return (
    <>
      {missing === '' ? null : <span>Declared, not registered: {missing}</span>}
      {undeclared === '' ? null : <span role="alert">Registered, not in theme.json (never drawn): {undeclared}</span>}
    </>
  )
}

export function Toolbar(props: ToolbarProps) {
  const { settings, onChange, presets, forcedTone } = props
  const set = (changes: Partial<HarnessSettings>): void => onChange({ ...settings, ...changes })
  const preset = settings.preset ?? presets[0]?.id ?? ''
  return (
    <div role="region" aria-label="Theme harness" style={BAR_STYLE}>
      <SelectField label="View" value={props.path} options={viewOptions(props.views, props.path)} onSelect={props.onPath} />
      {presets.length === 0 ? null : (
        <SelectField
          label="Look"
          value={preset}
          options={presets.map((look) => ({ value: look.id, label: look.name }))}
          onSelect={(value) => set({ preset: value })}
        />
      )}
      <SelectField
        label="Width"
        value={settings.width === null ? WINDOW_WIDTH : String(settings.width)}
        options={widthOptions(props.minWidth, settings.width)}
        onSelect={(value) => set({ width: widthOf(value) })}
      />
      <SelectField
        label={forcedTone === null ? 'Tone' : 'Tone (the theme sets it)'}
        value={forcedTone ?? settings.tone}
        options={TONE_OPTIONS}
        disabled={forcedTone !== null}
        onSelect={(value) => set({ tone: value === 'dark' ? 'dark' : 'light' })}
      />
      <CheckField label="Reduced motion" checked={settings.reducedMotion} onToggle={(checked) => set({ reducedMotion: checked })} />
      <CheckField label="Forced colours" checked={settings.forcedColors} onToggle={(checked) => set({ forcedColors: checked })} />
      <CheckField label="Transcript" checked={settings.transcript} onToggle={(checked) => set({ transcript: checked })} />
      <a href={PHONE_PATH} style={LINK_STYLE}>Phone view</a>
      <ReportLines report={props.report} />
    </div>
  )
}
