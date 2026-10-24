/**
 * The phone view's controls: the screen (Chat, the Command Centre, First open), the user's Light / Dark (off while the
 * painting or the theme sets its own tone, as the app follows a fromLooks painting's tone and the toolbar a forced
 * one), the member's look (for a painting from looks, and for a theme the phone draws in its built-in layout) and
 * reduced motion; and a link back to the harness's mock host. Every control is a labelled native one, and each change
 * goes into the address, so a reload opens the same view.
 */
import type { HostLook } from '@automatos/theme-sdk'
import type { ChangeEvent, CSSProperties } from 'react'
import { NO_STORED_LOOK, PHONE_SCREENS, type PhoneScheme, type PhoneScreen, type PhoneSettings } from '../../src/phone/settings.ts'

export const SCREEN_NAMES: Readonly<Record<PhoneScreen, string>> = Object.freeze({
  'chat': 'Chat',
  'command-centre': 'Command Centre',
  'first-open': 'First open',
})
export const NO_STORED_LOOK_NAME = "No stored look (the table's defaults)"

export interface PhoneControlsProps {
  readonly settings: PhoneSettings
  /** The tone the painting or the theme sets; null while the user's Light / Dark holds. */
  readonly forcedScheme: PhoneScheme | null
  /** The looks to pick from; empty hides the switch. */
  readonly looks: readonly HostLook[]
  /** True offers no stored look as well (the server then paints the table's defaults). */
  readonly offerDefaults: boolean
  readonly onChange: (next: PhoneSettings) => void
}

const BAR_STYLE: CSSProperties = Object.freeze({
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 20px', padding: '8px 16px', background: '#f4f4f5',
  color: '#18181b', borderBottom: '1px solid #a1a1aa', fontFamily: 'system-ui, sans-serif', fontSize: '14px',
})
const FIELD_STYLE: CSSProperties = Object.freeze({ display: 'inline-flex', alignItems: 'center', gap: '6px' })

interface Option {
  readonly value: string
  readonly label: string
}

function SelectField(props: { label: string; value: string; options: readonly Option[]; disabled?: boolean; onSelect: (value: string) => void }) {
  const { label, value, options, disabled = false, onSelect } = props
  return (
    <label style={FIELD_STYLE}>
      {label}
      <select value={value} disabled={disabled} onChange={(event: ChangeEvent<HTMLSelectElement>) => onSelect(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

const isScreen = (value: string): value is PhoneScreen => PHONE_SCREENS.some((screen) => screen === value)

function lookOptions(looks: readonly HostLook[], offerDefaults: boolean): Option[] {
  const presets = looks.map((look) => ({ value: look.id, label: look.name }))
  return offerDefaults ? [...presets, { value: NO_STORED_LOOK, label: NO_STORED_LOOK_NAME }] : presets
}

export function PhoneControls({ settings, forcedScheme, looks, offerDefaults, onChange }: PhoneControlsProps) {
  const set = (changes: Partial<PhoneSettings>): void => onChange({ ...settings, ...changes })
  const look = settings.look ?? looks[0]?.id ?? ''
  return (
    <div role="region" aria-label="Phone view" style={BAR_STYLE}>
      <a href="/" style={{ color: '#1d4ed8' }}>Back to the harness</a>
      <SelectField
        label="Screen"
        value={settings.screen}
        options={PHONE_SCREENS.map((screen) => ({ value: screen, label: SCREEN_NAMES[screen] }))}
        onSelect={(value) => set({ screen: isScreen(value) ? value : settings.screen })}
      />
      <SelectField
        label={forcedScheme === null ? 'Light / Dark' : 'Light / Dark (the look sets it)'}
        value={forcedScheme ?? settings.scheme}
        options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
        disabled={forcedScheme !== null}
        onSelect={(value) => set({ scheme: value === 'dark' ? 'dark' : 'light' })}
      />
      {looks.length === 0 ? null : (
        <SelectField label="Look" value={look} options={lookOptions(looks, offerDefaults)} onSelect={(value) => set({ look: value })} />
      )}
      <label style={FIELD_STYLE}>
        <input type="checkbox" checked={settings.reducedMotion} onChange={(event) => set({ reducedMotion: event.target.checked })} />
        Reduced motion
      </label>
    </div>
  )
}
