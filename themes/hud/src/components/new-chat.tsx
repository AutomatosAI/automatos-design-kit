import { useStartChat } from '@automatos/theme-sdk'

import styles from './new-chat.module.css'

/**
 * New chat: a fresh new chat in the host's chat session, then the chat (the SDK's useStartChat), pressable once the
 * session is ready. HUD's secondary button (an accent-line outline, mono capitals), with a + the name leaves out. The
 * core screen's title row and the Conversations page each carry one.
 */

export const NEW_CHAT = 'New chat'

export function NewChatButton() {
  const { startChat, ready } = useStartChat()
  return (
    <button type="button" className={styles.newChat} onClick={startChat} disabled={!ready}>
      <span className={styles.plus} aria-hidden="true">
        +
      </span>
      {NEW_CHAT}
    </button>
  )
}
