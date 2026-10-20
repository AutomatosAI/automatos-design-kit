/**
 * Play's entry: the theme the host loads when automatos/play is the active theme.
 *
 * It registers what core's builtin Play registers (frontend/lib/theme-host/builtin/play-slots.tsx and
 * play-entry.ts): the frame, the look editor, the style sheet and the 404 as slots; its chat and
 * Deliverables as the host's /chat and /deliverables pages; its Conversations page as the route
 * `conversations` (/x/conversations). theme.json declares the same slots, pages and route; asleep@1 is
 * declared there but not registered, because Play's frame draws the asleep screen itself (AsleepGate).
 *
 * The two global stylesheets come first, as core's play-client.ts brings in app/play-theme.css: the display
 * faces and their variables, then Play's tokens and base rules. Every CSS module the components import
 * follows, and the preset puts them all into dist/theme.css, each rule under html.play.
 */
import './app/play-fonts.css'
import './app/play-theme.css'

import { defineTheme } from '@automatos/theme-sdk'

import {
  LooksScreen,
  LostScreen,
  PLAY_CONVERSATIONS_ROUTE,
  PlayChat,
  PlayConversations,
  PlayFrameSlot,
  PlayShelf,
  StyleScreen,
} from './play-slots'

export default defineTheme({
  register(host) {
    host.registerSlot('frame@1', PlayFrameSlot)
    host.registerSlot('lookEditor@1', LooksScreen)
    host.registerSlot('styleSheet@1', StyleScreen)
    host.registerSlot('notFound@1', LostScreen)
    host.registerPage('/chat', PlayChat)
    host.registerPage('/deliverables', PlayShelf)
    host.registerRoute(PLAY_CONVERSATIONS_ROUTE, PlayConversations)
  },
})
