import { type ActivityFeedFilters, useActivityFeed, useAgents, useNeedsYou } from '@automatos/theme-sdk'

import { AgentAvatar } from '../art/pixel-art'
import { needyNames, partyCount, partyOf, STATE_WORDS, workingIds, type PartyMember } from './party-rows'
import styles from './party.module.css'
import ui from '../ui/ui.module.css'

/**
 * The party: the workspace's agents (the SDK's useAgents), each with its robot, name, role and state word, the word
 * always with its glyph so colour is never the only sign. The desktop draws it as a window beside the story; the
 * handheld as a strip of robots over the story, each named with its state.
 */

export const PARTY_LABEL = 'Party'
export const PARTY_LOADING = 'Gathering the party…'
export const PARTY_FAILED = "Couldn't load the party."
export const PARTY_EMPTY = 'No agents in the party yet.'
/** The runs working now, as many as the state words read: one constant, so the host's query keeps its key. */
const WORKING_RUNS: ActivityFeedFilters = Object.freeze({ status: 'working', limit: 100 })

export function useParty(): { readonly members: readonly PartyMember[] | null; readonly error: string | null } {
  const agents = useAgents()
  const needsYou = useNeedsYou()
  const feed = useActivityFeed(WORKING_RUNS)
  if (agents.data === null) return { members: null, error: agents.error }
  return { members: partyOf(agents.data, needyNames(needsYou.data), workingIds(feed.data)), error: null }
}

function Member({ member }: { readonly member: PartyMember }) {
  const status = STATE_WORDS[member.state]
  return (
    <li className={styles.member}>
      <span className={styles.avatarBox}>
        <AgentAvatar index={member.look} />
      </span>
      <span className={styles.memberText}>
        <span className={styles.memberName}>{member.name}</span>
        <span className={styles.memberRole}>{member.role}</span>
        <span className={ui.status} data-tone={member.state}>
          <span aria-hidden="true">{status.glyph}</span> {status.word.toUpperCase()}
        </span>
      </span>
    </li>
  )
}

function Note({ members, error }: { readonly members: readonly PartyMember[] | null; readonly error: string | null }) {
  if (members === null) return <p className={ui.note}>{error === null ? PARTY_LOADING : PARTY_FAILED}</p>
  return members.length === 0 ? <p className={ui.note}>{PARTY_EMPTY}</p> : null
}

export function PartyWindow() {
  const { members, error } = useParty()
  return (
    <aside className={`${ui.window} ${styles.party}`} aria-label={PARTY_LABEL}>
      <div className={styles.partyHead}>
        <h2 className={ui.label}>{PARTY_LABEL}</h2>
        {members !== null && <span className={ui.aside}>{partyCount(members.length)}</span>}
      </div>
      <Note members={members} error={error} />
      {members !== null && members.length > 0 && (
        <ul className={styles.members}>
          {members.map((member) => (
            <Member key={member.id} member={member} />
          ))}
        </ul>
      )}
    </aside>
  )
}

export function PartyStrip() {
  const { members, error } = useParty()
  return (
    <section className={styles.partyStrip} aria-label={PARTY_LABEL}>
      <h2 className={`${ui.label} ${styles.stripLabel}`}>{PARTY_LABEL}</h2>
      <Note members={members} error={error} />
      {members !== null && members.length > 0 && (
        <ul className={styles.stripMembers}>
          {members.map((member) => {
            const status = STATE_WORDS[member.state]
            return (
              <li key={member.id} className={styles.stripMember}>
                <AgentAvatar index={member.look} view="agent-small" label={`${member.name}, ${status.word}`} />
                <span className={ui.status} data-tone={member.state} aria-hidden="true">
                  {status.glyph}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
