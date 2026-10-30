import { HostLink } from '@automatos/theme-sdk'

import { initialOf } from '../ui/sets'
import { agentHref, jobOf, statusOf, type RosterEntry } from './roster'
import styles from './agents.module.css'
import ui from '../ui/ui.module.css'

/**
 * One agent of Your team: a round avatar (a gradient ring and a gradient centre while active, a grey ring and a
 * quiet centre while not) with the agent's initial, the name, the job, and at the foot the status, a glyph and a
 * word, and the team. The name links to the host's agents page with this agent open, and the link covers the card.
 */

export function AgentCard({ entry }: { readonly entry: RosterEntry }) {
  const { agent, set } = entry
  const status = statusOf(agent.status)
  const job = jobOf(agent)
  return (
    <li className={`${ui.window} ${ui.lift} ${styles.card}`}>
      <span className={styles.ring} data-active={status.active ? 'true' : 'false'} aria-hidden="true">
        <span className={styles.face} data-set={status.active ? set : 'none'}>
          {initialOf(agent.name)}
        </span>
      </span>
      <h2 className={styles.name}>
        <HostLink href={agentHref(agent.id)} className={styles.nameLink}>
          {agent.name}
        </HostLink>
      </h2>
      {job !== null && (
        <p className={styles.job} title={job}>
          {job}
        </p>
      )}
      <p className={styles.foot}>
        <span className={ui.chip} data-quiet={status.active ? undefined : 'true'}>
          <span aria-hidden="true">{status.glyph}</span> {status.word}
        </span>
        {agent.team?.trim() ? (
          <span className={ui.chip}>
            <span className={ui.srOnly}>Team: </span>
            {agent.team.trim()}
          </span>
        ) : null}
      </p>
    </li>
  )
}
