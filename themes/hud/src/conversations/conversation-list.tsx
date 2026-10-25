import { chatHref, HostLink } from '@automatos/theme-sdk'

import { Panel } from '../components/panel'
import {
  type ConversationGroup,
  type ConversationSummary,
  conversationTitle,
  groupConversations,
  lastActive,
  previewLine,
  relativeTime,
} from './conversations'
import styles from './conversations.module.css'

/**
 * The grouped list (after Play's, themes/play/src/components/play/conversations/conversation-list.tsx, Play 1.1.1),
 * as HUD panels: Today, This week and Earlier, each a bracketed panel named by its heading, with how many it holds;
 * a row is the title, the time and the newest line, split by the look's line, and opens the conversation in the chat
 * (the SDK's chatHref, through HostLink).
 */

export interface ConversationListProps {
  readonly chats: readonly ConversationSummary[]
  readonly now: Date
}

export function ConversationList({ chats, now }: ConversationListProps) {
  return (
    <div className={styles.groups}>
      {groupConversations(chats, now).map((group) => (
        <Group key={group.label} group={group} now={now} />
      ))}
    </div>
  )
}

function Group({ group, now }: { readonly group: ConversationGroup; readonly now: Date }) {
  return (
    <Panel title={group.label} value={String(group.chats.length)}>
      <ul className={styles.list}>
        {group.chats.map((chat) => (
          <li key={chat.id} className={styles.item}>
            <Row chat={chat} now={now} />
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function Row({ chat, now }: { readonly chat: ConversationSummary; readonly now: Date }) {
  const active = lastActive(chat)
  const preview = previewLine(chat)
  return (
    <HostLink href={chatHref(chat.id)} className={styles.row}>
      <span className={styles.rowTop}>
        <span className={styles.rowTitle}>{conversationTitle(chat)}</span>
        {active && (
          <time className={styles.time} dateTime={active.toISOString()}>
            {relativeTime(active, now)}
          </time>
        )}
      </span>
      {preview && <span className={styles.preview}>{preview}</span>}
    </HostLink>
  )
}
