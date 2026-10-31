/**
 * PRD-268 (SDK 1.3.0): the stand-in for SDK card `ReadinessList`. It mirrors core's
 * frontend/lib/theme-sdk/host-cards/proactive-cards.tsx ReadinessList over components/proactive/readiness-list.tsx (at
 * 1a8956c874dc42cff05b96f431c50b7d722a71aa): the props checked (Readiness@1 read as the host reads it, a TypeError
 * naming the prop), then "What Auto depends on", each item (the server's, then the browser's own) as its label, its
 * detail, its state as a glyph and a word (✓ Ready, ○ Not checked, ◆ Needs setup), and its fix as an in-app link, each
 * row one sentence for a screen reader; "Checking…" while nothing is read, one line when the read failed; and Check
 * again, which runs the fake area's useCheckReadiness (kept as a run). Over the server's limit (a refusal whose code is
 * `checked_recently`) it says "Checked a moment ago"; any other refusal is one line. The newer answer is shown.
 */
import type { Readiness, ReadinessItem } from '@automatos/theme-sdk'
import { type ReactElement, useId, useMemo, useState } from 'react'
import { readinessStateLabel } from '../../internal/proactive/labels.ts'
import { checkedClientItems, checkedReadiness, readFailure } from '../../internal/proactive/props.ts'
import { appPath, refusalCode, refusedLine } from '../../internal/proactive/wire.ts'
import { HostLink } from '../navigation.ts'
import { useCheckReadiness } from '../proactive.ts'
import { Eyebrow, RefusedLine, StatePill } from './proactive-parts.tsx'
import { CARD, LINE, LIST, MUTED, QUIET_BUTTON, ROW, SMALL_MUTED, TEXT_BUTTON, TITLE } from './proactive-styles.ts'

type Sdk = typeof import('@automatos/theme-sdk')

export const READINESS_TITLE = 'What Auto depends on'
export const CHECK_AGAIN = 'Check again'
export const CHECKING = 'Checking…'
export const CHECKED_A_MOMENT_AGO = 'Checked a moment ago'
/** hooks/use-readiness.ts CHECKED_RECENTLY. */
export const CHECKED_RECENTLY = 'checked_recently'

/** readiness-list.tsx readinessSentence: "Calendar: needs setup. Connect calendar." */
export function readinessSentence(item: ReadinessItem): string {
  const word = readinessStateLabel(item.state)?.word.toLowerCase() ?? ''
  return item.fix ? `${item.label}: ${word}. ${item.fix.label}.` : `${item.label}: ${word}.`
}

/** readiness-list.tsx newestReadiness: Check again's answer unless the one read is later. */
function newest(read: Readiness | null, checked: Readiness | null): Readiness | null {
  if (!checked) return read
  if (!read) return checked
  const readAt = Date.parse(read.checked_at)
  const checkedAt = Date.parse(checked.checked_at)
  return Number.isNaN(readAt) || Number.isNaN(checkedAt) || checkedAt >= readAt ? checked : read
}

function Row({ item }: { readonly item: ReadinessItem }): ReactElement | null {
  const detailId = useId()
  const label = readinessStateLabel(item.state)
  if (label === null) return null
  const fix = item.fix && appPath(item.fix.href) ? item.fix : null
  return (
    <li
      data-readiness-id={item.id} data-state={item.state} aria-label={readinessSentence({ ...item, fix })}
      aria-describedby={item.detail ? detailId : undefined} style={{ ...ROW, justifyContent: 'space-between' }}
    >
      <div>
        <p style={TITLE}>{item.label}</p>
        {item.detail ? <p id={detailId} style={SMALL_MUTED}>{item.detail}</p> : null}
      </div>
      <div style={LINE}>
        <StatePill label={label} />
        {fix ? <HostLink href={fix.href} style={TEXT_BUTTON}>{fix.label}</HostLink> : null}
      </div>
    </li>
  )
}

/** Check again over the fake area's useCheckReadiness, and what became of the last one. */
function useCheckAgain() {
  const check = useCheckReadiness()
  const [checked, setChecked] = useState<Readiness | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const run = (): void => {
    setFailure(null)
    check.runAsync().then((answer: Readiness | null) => setChecked(answer), setFailure)
  }
  const limited = refusalCode(failure) === CHECKED_RECENTLY
  return { run, checked, running: check.isRunning, limited, refused: limited ? null : refusedLine(failure) }
}

/** cards.ReadinessList: each item's state and fix, and Check again. */
export const ReadinessList: Sdk['ReadinessList'] = function ReadinessList({ readiness, error, clientItems, className }) {
  const read = useMemo(() => checkedReadiness(readiness), [readiness])
  const client = useMemo(() => checkedClientItems(clientItems), [clientItems])
  const failed = readFailure(error)
  const again = useCheckAgain()
  const shown = newest(read, again.checked)
  const failedLine = shown === null && failed ? refusedLine(failed) : null
  const checking = (shown === null && failedLine === null) || again.running
  return (
    <section aria-label={READINESS_TITLE} aria-busy={checking} className={className} style={CARD}>
      <Eyebrow>{READINESS_TITLE}</Eyebrow>
      <RefusedLine text={failedLine} />
      {shown === null && failedLine === null ? <p role="status" style={MUTED}>{CHECKING}</p> : null}
      {shown ? <ul style={LIST}>{[...shown.items, ...client].map((item, index) => <Row key={`${index}:${item.id}`} item={item} />)}</ul> : null}
      <div style={LINE}>
        <button type="button" aria-busy={again.running} disabled={again.running} style={QUIET_BUTTON} onClick={again.run}>
          {again.running ? CHECKING : CHECK_AGAIN}
        </button>
        {again.limited ? <p role="status" style={SMALL_MUTED}>{CHECKED_A_MOMENT_AGO}</p> : null}
        <RefusedLine text={again.refused} />
      </div>
    </section>
  )
}
