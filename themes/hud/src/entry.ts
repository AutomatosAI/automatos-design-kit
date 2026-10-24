/**
 * HUD's entry: the module the host loads when automatos/hud is the active theme.
 *
 * It registers what theme.json declares, one module per slot, so each screen of HUD's owns its own file:
 * the frame around every page (slots/frame.tsx), the look editor at /looks (slots/look-editor.tsx) and the
 * style sheet at /looks/style (slots/style-sheet.tsx). Every page HUD doesn't own is the host's, drawn inside
 * the frame on Studio and recoloured by the look, whose first paint is data (boot/prepaint.json).
 *
 * The two global stylesheets come first: the display faces, then HUD's tokens and base rules. Every CSS module
 * the components import follows, and the kit's preset puts them all into dist/theme.css, each rule under
 * html.hud.
 */
import './app/hud-fonts.css'
import './app/hud-theme.css'

import { defineTheme } from '@automatos/theme-sdk'

import { HudFrameSlot } from './slots/frame'
import { HudLookEditor } from './slots/look-editor'
import { HudStyleSheet } from './slots/style-sheet'
import { HudChat } from './pages/chat'

export default defineTheme({
  register(host) {
    host.registerSlot('frame@1', HudFrameSlot)
    host.registerSlot('lookEditor@1', HudLookEditor)
    host.registerSlot('styleSheet@1', HudStyleSheet)
    host.registerPage('/chat', HudChat)
  },
})
