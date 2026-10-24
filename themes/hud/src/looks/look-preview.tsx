import { Panel } from '../components/panel'
import type { HudLook } from '../lib/looks/types'
import { HudAuto } from '../mascot/hud-auto'
import styles from './preview.module.css'

/**
 * The LOOK page's preview: a small voice core of "Automatos Command HUD.dc.html" (its rings turning, its pulse, Auto
 * in the middle while the look's Auto is on), its state chip, three agents and a primary and a secondary button,
 * all drawn from the look's variables, so a change in the drawer shows here at once (and on every page). Sample
 * words only: nothing here reads or does anything.
 *
 * The rings and the pulse turn only while they may: not under the user's reduced-motion setting, not while the
 * look's motion is off (data-motion="still"; the stylesheet animates only under data-motion="on"). Each carries
 * data-hud-loop as well, so the look's motion variable and the host's data-theme-motion="reduce" stop them too.
 * Auto is his still here: the frame's dock is where he moves, beside his Pause Auto control.
 */

export const PREVIEW_TITLE = 'Preview'
export const PREVIEW_STATE = 'Searching the web'
export const PREVIEW_AGENTS_LABEL = 'Agents'
export const PREVIEW_AUTO_SIZE = 112

interface SampleAgent {
  readonly name: string
  readonly glyph: string
  readonly status: string
  readonly live?: boolean
}

/** Made-up agents: a status is always a glyph and a word, never the colour alone. */
export const PREVIEW_AGENTS: readonly SampleAgent[] = [
  { name: 'Researcher', glyph: '●', status: 'Searching', live: true },
  { name: 'Scribe', glyph: '○', status: 'Queued' },
  { name: 'Analyst', glyph: '—', status: 'Idle' },
]

/** True when the preview's rings may turn. */
export function previewMoves(look: Pick<HudLook, 'motion'>, reducedMotion: boolean): boolean {
  return !reducedMotion && look.motion === 'on'
}

function Core({ moving }: { readonly moving: boolean }) {
  return (
    <div className={styles.core} data-motion={moving ? 'on' : 'still'} data-testid="hud-preview-core" aria-hidden="true">
      <span className={styles.ringOuter} />
      <span className={`${styles.ring} ${styles.arc}`} data-hud-loop="" />
      <span className={`${styles.ring} ${styles.dashed}`} data-hud-loop="" />
      <span className={`${styles.ring} ${styles.inner}`} data-hud-loop="" />
      <span className={styles.pulse} data-hud-loop="" />
      <span className={styles.auto}>
        <HudAuto state="searching" size={PREVIEW_AUTO_SIZE} decorative playing={false} />
      </span>
    </div>
  )
}

export interface LookPreviewProps {
  readonly look: HudLook
  readonly reducedMotion: boolean
}

export function LookPreview({ look, reducedMotion }: LookPreviewProps) {
  return (
    <Panel title={PREVIEW_TITLE} value={look.name} live className={styles.preview}>
      <div className={styles.stage}>
        <Core moving={previewMoves(look, reducedMotion)} />
        <p className={styles.chip}>{PREVIEW_STATE}</p>
      </div>
      <ul className={styles.agents} aria-label={PREVIEW_AGENTS_LABEL}>
        {PREVIEW_AGENTS.map((agent) => (
          <li key={agent.name} className={styles.agent} data-live={agent.live === true ? 'true' : undefined}>
            <span className={styles.agentName}>{agent.name}</span>
            <span className={styles.agentStatus}>
              <span aria-hidden="true">{agent.glyph}</span> {agent.status}
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.samples} aria-hidden="true">
        <span className={styles.samplePrimary}>Open Mission</span>
        <span className={styles.sampleSecondary}>Pause</span>
      </div>
    </Panel>
  )
}
