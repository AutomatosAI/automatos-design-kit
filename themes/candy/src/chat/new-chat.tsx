import { useStartChat } from '@automatos/theme-sdk'

import styles from './chat.module.css'
import ui from '../ui/ui.module.css'

/**
 * New chat (the SDK's useStartChat: a fresh conversation, then the chat page): the header's "+ New chat" pill on a
 * desktop, a round "+" on the phone's stage. Disabled until the host is ready to start one.
 */

export const NEW_CHAT = 'New chat'

export function NewChatPill() {
  const { startChat, ready } = useStartChat()
  return (
    <button type="button" className={`${ui.secondary} ${styles.newChat}`} onClick={startChat} disabled={!ready}>
      <span aria-hidden="true">+</span> {NEW_CHAT}
    </button>
  )
}

export function NewChatRound({ className }: { readonly className: string }) {
  const { startChat, ready } = useStartChat()
  return (
    <button type="button" className={className} onClick={startChat} disabled={!ready} aria-label={NEW_CHAT}>
      <span aria-hidden="true">+</span>
    </button>
  )
}
