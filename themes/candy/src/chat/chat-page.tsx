// After themes/arcade/src/chat/chat-page.tsx (Arcade 1.0.0): the page around one conversation.
import { useBoardEventStream, useChatController } from '@automatos/theme-sdk'

import { Auto } from '../art/auto'
import { ChatView } from './chat-view'
import styles from './chat.module.css'
import ui from '../ui/ui.module.css'

/**
 * Candy's /chat (theme.json "pages"): the conversation on screen is the host's (the SDK's useChatController called
 * without a conversation: a ?chatId= link, a new chat, a chat the backend names kept on screen); while it opens,
 * Auto loads. The view is keyed by the conversation, so switching conversations starts it afresh. The page holds the
 * board's event lane open, as the Studio chat does, so a reply that lands after its turn shows live.
 */

export const OPENING = 'Opening your chat…'
/** Auto's size while the chat opens, in px. */
const OPENING_SIZE = 120

export function ChatOpening() {
  return (
    <div className={styles.opening} role="status">
      <Auto state="loading" size={OPENING_SIZE} still />
      <p className={ui.note}>{OPENING}</p>
    </div>
  )
}

export function ChatPage() {
  useBoardEventStream(true)
  const { conversation } = useChatController()
  if (!conversation) return <ChatOpening />
  return <ChatView key={conversation.key} conversation={conversation} />
}
