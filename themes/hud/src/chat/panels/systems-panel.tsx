import { HostLink, type Readiness, type ReadinessItem, useCheckReadiness, useReadiness } from '@automatos/theme-sdk'

import { Panel } from '../../components/panel'
import styles from './panels.module.css'
import { readinessMark } from './status-marks'

/**
 * HUD 1.2.0 (PRD-268): SYSTEMS, what Auto depends on (the SDK's useReadiness, Readiness@1), where the design's THIS
 * MACHINE would be: each item its label, its state as a glyph and a word (✓ READY, ○ NOT CHECKED: the check didn't
 * answer in time, never a failure; ◆ NEEDS SETUP: a person must act, in the readable accent), the server's detail, and
 * its fix, a link inside the app. Check again asks the server to check every item now (useCheckReadiness, which the
 * server limits; a refusal is one line). The header's value is how many are ready, of how many. Never glows.
 */

export const SYSTEMS_TITLE = 'Systems'
export const SYSTEMS_LOADING = 'Checking what Auto depends on…'
export const SYSTEMS_FAILED = "Couldn't check what Auto depends on."
export const CHECK_AGAIN = 'Check again'
/** A path inside the app: what a fix may link to. */
const APP_PATH = /^\/(?![/\\])/

function SystemRow({ item }: { readonly item: ReadinessItem }) {
  const mark = readinessMark(item.state)
  const fix = item.fix && APP_PATH.test(item.fix.href) ? item.fix : null
  return (
    <li className={styles.row} data-readiness-id={item.id} data-state={mark ? item.state : undefined}>
      <span className={styles.rowHead}>
        <span className={styles.name}>{item.label}</span>
        {mark !== null && (
          <span className={styles.status} data-tone={mark.tone}>
            <span aria-hidden="true">{mark.glyph}</span> {mark.word}
          </span>
        )}
      </span>
      {item.detail && <span className={styles.detail}>{item.detail}</span>}
      {fix !== null && (
        <HostLink href={fix.href} className={styles.more}>
          {fix.label}
        </HostLink>
      )}
    </li>
  )
}

function readyCount(readiness: Readiness): string {
  return `${readiness.items.filter((item) => item.state === 'ready').length} / ${readiness.items.length}`
}

function CheckAgain() {
  const check = useCheckReadiness()
  return (
    <>
      <button type="button" className={styles.check} aria-busy={check.isRunning} disabled={check.isRunning} onClick={() => check.run()}>
        {CHECK_AGAIN}
      </button>
      {check.error !== null && (
        <p className={styles.note} role="status">
          {check.error}
        </p>
      )}
    </>
  )
}

export function SystemsPanel() {
  const { data, error } = useReadiness()
  return (
    <Panel title={SYSTEMS_TITLE} value={data === null ? undefined : readyCount(data)}>
      {data === null ? (
        <p className={styles.note}>{error === null ? SYSTEMS_LOADING : SYSTEMS_FAILED}</p>
      ) : (
        <ul className={styles.rows}>
          {data.items.map((item) => (
            <SystemRow key={item.id} item={item} />
          ))}
        </ul>
      )}
      <CheckAgain />
    </Panel>
  )
}
