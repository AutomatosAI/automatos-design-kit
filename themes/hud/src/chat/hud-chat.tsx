import { useBoardEventStream, useChatController } from '@automatos/theme-sdk'

import { usePhoneLayout } from '../lib/phone-layout'
import { HudChatView } from './chat-view'
import { OPENING } from './chip'
import { useScreenLayout } from './layout'
import { PhoneOpening } from './phone/phone-chat'
import { ChatScreen } from './screen'
import { VoiceCore } from './voice-core'

/**
 * HUD's core screen at /chat ("Automatos Command HUD.dc.html"): Auto's voice core with the conversation under it,
 * between the side panels. The conversation on screen is the host's (the SDK's useChatController, called without a
 * conversation: a ?chatId= link, a new chat, a chat the backend names kept on screen); while it opens, Auto loads in
 * the core. The view is keyed by the conversation, so switching conversations starts it afresh. The page holds the
 * board's event lane open (the SDK's useBoardEventStream), as the Studio chat does, so a reply that lands after its
 * turn (an awaited one, a background post) shows live. The page reaches the host only through the SDK. In a window
 * narrower than the desktop layout it is the design's phone screen (phone/phone-chat.tsx).
 */

export const OPENING_TITLE = 'Conversation'

/** A conversation on its way: Auto loading in the core, the words in the chip; on a phone, in the phone's core. */
export function ChatOpening() {
  return usePhoneLayout() ? <PhoneOpening title={OPENING_TITLE} /> : <DesktopOpening />
}

function DesktopOpening() {
  const { ref, layout } = useScreenLayout()
  return (
    <ChatScreen
      screenRef={ref}
      layout={layout}
      title={OPENING_TITLE}
      core={<VoiceCore state="loading" chip={OPENING} size={layout.core} />}
    />
  )
}

export function HudChatPage() {
  useBoardEventStream(true)
  const { conversation } = useChatController()
  if (!conversation) return <ChatOpening />
  return <HudChatView key={conversation.key} conversation={conversation} />
}
