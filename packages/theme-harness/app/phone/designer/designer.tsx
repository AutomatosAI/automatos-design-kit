/**
 * The skin designer, beside the phone view for any theme the phone draws on its Studio layout (never for automatos/play
 * or automatos/hud, which the phone draws in its own built-in layouts): a draft of the theme's `mobile` block
 * (src/phone/designer.ts) that the page paints on the phone and measures in the contrast panel at each change, kept
 * in the address so a reload opens it again, and exported as skin.json for `automatos-theme skin`.
 *
 * It starts from theme.json's block, or, with none, from Studio's own colours or a look's (start.tsx). Its controls:
 * where the colours come from (the draft's own tokens, or `fromLooks`, which needs the theme's boot/prepaint.json),
 * the schemes (Light alone, or Light and Dark, as the contract allows: `tokens.dark` is optional), each token of the
 * scheme on screen (token-fields.tsx), the three fonts and the mascot from the theme's own files (asset-fields.tsx),
 * and the export (export-panel.tsx). A failing pair's one-click fix is the contrast panel's.
 */
import type { FontRole } from '@automatos/theme-cli/mobile-answer'
import type { StudioColours } from '@automatos/theme-cli/phone'
import { useMemo, type CSSProperties, type ReactNode } from 'react'
import {
  editedScheme, fontFiles, lookDraft, studioDraft, withDark, withFont, withToken, type SkinDraft, type SkinSource,
} from '../../../src/phone/designer.ts'
import { skinExport } from '../../../src/phone/skin-export.ts'
import type { PhoneScheme } from '../../../src/phone/settings.ts'
import { memberLook, type PhoneSource } from '../../../src/phone/skin.ts'
import { FontFields, MascotField } from './asset-fields.tsx'
import { ExportPanel } from './export-panel.tsx'
import { StartRow } from './start.tsx'
import { TokenFields } from './token-fields.tsx'

export const DESIGNER_HEADING = 'Skin designer'
export const NO_BLOCK_START = 'theme.json has no mobile block yet: start a draft of one.'
export const EDITED_TEXT = "The phone and the contrast panel show the draft, not theme.json's block."
export const UNEDITED_TEXT = "The draft is theme.json's own block, until a change."
export const SOURCE_NAMES: Readonly<Record<SkinSource, string>> = Object.freeze({
  tokens: 'Its own colours (tokens)',
  fromLooks: "The member's look (fromLooks)",
})
export const NO_TABLE_TEXT = ' (the theme has no boot/prepaint.json)'
export const SCHEME_CHOICES = Object.freeze({ light: 'Light only: the phone draws Light under Dark too', both: 'Light and Dark' })

const PANEL_STYLE: CSSProperties = Object.freeze({
  display: 'flex', flexDirection: 'column', gap: '12px', flex: '1 1 380px', minWidth: 0, maxWidth: '560px',
  fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#18181b', background: '#ffffff',
  border: '1px solid #a1a1aa', borderRadius: '8px', padding: '12px 16px',
})
const SET_STYLE: CSSProperties = Object.freeze({ border: '1px solid #d4d4d8', borderRadius: '6px', padding: '8px 12px', margin: 0 })
const CHOICE_STYLE: CSSProperties = Object.freeze({ display: 'flex', alignItems: 'center', gap: '6px', margin: '2px 0' })

export interface SkinDesignerProps {
  /** The theme as theme.json has it (not the draft). */
  readonly source: PhoneSource
  /** The draft: the address's, else theme.json's block; null for a theme with no block and nothing started. */
  readonly draft: SkinDraft | null
  /** True when the draft is the address's, not theme.json's block. */
  readonly edited: boolean
  /** The scheme on screen. */
  readonly scheme: PhoneScheme
  /** The member's look on the phone (settings.ts). */
  readonly look: string | null
  /** The colours the phone paints for the scheme on screen. */
  readonly colours: StudioColours
  /** A new draft, or null: back to theme.json's block. */
  readonly onDraft: (draft: SkinDraft | null) => void
}

interface ChoiceProps {
  readonly name: string
  readonly checked: boolean
  readonly disabled?: boolean
  readonly onPick: () => void
  readonly children: ReactNode
}

function Choice({ name, checked, disabled = false, onPick, children }: ChoiceProps) {
  return (
    <label style={CHOICE_STYLE}>
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onPick} />
      {children}
    </label>
  )
}

interface FieldProps {
  readonly draft: SkinDraft
  readonly onDraft: (draft: SkinDraft) => void
}

function SourceField({ draft, hasTable, onDraft }: FieldProps & { readonly hasTable: boolean }) {
  return (
    <fieldset style={SET_STYLE}>
      <legend>Colours from</legend>
      <Choice name="skin-source" checked={draft.source === 'tokens'} onPick={() => onDraft({ ...draft, source: 'tokens' })}>
        {SOURCE_NAMES.tokens}
      </Choice>
      <Choice name="skin-source" checked={draft.source === 'fromLooks'} disabled={!hasTable}
        onPick={() => onDraft({ ...draft, source: 'fromLooks' })}>
        {`${SOURCE_NAMES.fromLooks}${hasTable ? '' : NO_TABLE_TEXT}`}
      </Choice>
    </fieldset>
  )
}

function SchemesField({ draft, onDraft }: FieldProps) {
  return (
    <fieldset style={SET_STYLE}>
      <legend>Schemes</legend>
      <Choice name="skin-schemes" checked={draft.dark === null} onPick={() => onDraft(withDark(draft, false))}>{SCHEME_CHOICES.light}</Choice>
      <Choice name="skin-schemes" checked={draft.dark !== null} onPick={() => onDraft(withDark(draft, true))}>{SCHEME_CHOICES.both}</Choice>
    </fieldset>
  )
}

type DraftFieldsProps = Omit<SkinDesignerProps, 'draft' | 'edited' | 'look'> & { readonly draft: SkinDraft }

/** The draft's controls, once there is a draft. */
function DraftFields({ source, draft, scheme, colours, onDraft }: DraftFieldsProps) {
  const fonts = useMemo(() => fontFiles(source.assets), [source.assets])
  const exported = useMemo(() => skinExport(source, draft), [source, draft])
  const editing = editedScheme(draft, scheme)
  const tokens = editing === 'dark' ? draft.dark ?? draft.light : draft.light
  return (
    <>
      <SourceField draft={draft} hasTable={source.prepaint !== null} onDraft={onDraft} />
      {draft.source === 'tokens' ? <SchemesField draft={draft} onDraft={onDraft} /> : null}
      {draft.source === 'tokens' ? (
        <TokenFields editing={editing} shownScheme={scheme} values={tokens} colours={colours}
          onToken={(token, value) => onDraft(withToken(draft, editing, token, value))} />
      ) : null}
      <FontFields fonts={draft.fonts} files={fonts} onFont={(role: FontRole, path) => onDraft(withFont(draft, role, path))} />
      <MascotField mode={draft.mascot} manifest={source.manifest} assets={source.assets} onMode={(mascot) => onDraft({ ...draft, mascot })} />
      <ExportPanel exported={exported} />
    </>
  )
}

export function SkinDesigner(props: SkinDesignerProps) {
  const { source, draft, edited, look, onDraft } = props
  const hasBlock = typeof source.manifest.mobile === 'object' && source.manifest.mobile !== null
  const lookStart = (id: string): SkinDraft | null => (
    lookDraft(source.prepaint, memberLook(source.presets, id), source.manifest.tone)
  )
  const fromLook = (id: string): void => {
    const started = lookStart(id)
    if (started !== null) onDraft(started)
  }
  return (
    <section aria-labelledby="skin-designer-heading" data-skin-designer={edited ? 'edited' : 'theme'} style={PANEL_STYLE}>
      <h2 id="skin-designer-heading" style={{ margin: 0, fontSize: '16px' }}>{DESIGNER_HEADING}</h2>
      <p style={{ margin: 0 }}>{draft === null ? NO_BLOCK_START : edited ? EDITED_TEXT : UNEDITED_TEXT}</p>
      <StartRow hasBlock={hasBlock} looks={source.presets} look={look} startsFrom={(id) => lookStart(id) !== null}
        onBlock={() => onDraft(null)} onStudio={() => onDraft(studioDraft())} onLook={fromLook} />
      {draft === null ? null : <DraftFields {...props} draft={draft} />}
    </section>
  )
}
