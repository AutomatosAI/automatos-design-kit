import { useBoardEventStream, useChatController } from '@automatos/theme-sdk'

import { AutoSprite } from '../art/pixel-art'
import { ChatView } from './chat-view'
import styles from './chat.module.css'
import ui from '../ui/ui.module.css'

/**
 * Arcade's /chat (theme.json "pages"): the conversation on screen is the host's (the SDK's useChatController called
 * without a conversation: a ?chatId= link, a new chat, a chat the backend names kept on screen); while it opens,
 * Auto loads. The view is keyed by the conversation, so switching conversations starts it afresh. The page holds the
 * board's event lane open, as the Studio chat does, so a reply that lands after its turn shows live.
 */

export const OPENING = 'Loading the story…'

export function ChatOpening() {
  return (
    <div className={styles.opening} role="status">
      <AutoSprite state="loading" view="small" />
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
