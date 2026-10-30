/**
 * Arcade's entry: the module the host loads when automatos/arcade is the active theme.
 *
 * It registers what theme.json declares: the frame around every page, the Options screen (the host's /looks page),
 * the Sprite gallery (/looks/style), the 404, Auto asleep in the host's shared empty state, its own /chat and
 * /deliverables (the Inventory), and its own route, /x/quests. Every other page is the host's own, drawn inside the
 * frame on the theme's base (Studio) and recoloured by the palette, whose first paint is data (boot/prepaint.json).
 *
 * The global stylesheet comes first, then the CSS modules the components import: the kit's preset puts them all
 * into dist/theme.css, each rule under html.arcade.
 */
import './app/theme.css'

import { defineTheme } from '@automatos/theme-sdk'

import { EmptyStateAuto } from './edges/empty-state'
import { NotFound } from './edges/not-found'
import { Frame } from './frame/frame'
import { LookEditor } from './looks/look-editor'
import { ChatRoute, InventoryRoute, QuestsRoute } from './pages/pages'
import { QUESTS_ROUTE } from './routes'
import { StyleSheet } from './style/style-sheet'

export default defineTheme({
  register(host) {
    host.registerSlot('frame@1', Frame)
    host.registerSlot('lookEditor@1', LookEditor)
    host.registerSlot('styleSheet@1', StyleSheet)
    host.registerSlot('notFound@1', NotFound)
    host.registerSlot('empty-state.mascot@1', EmptyStateAuto)
    host.registerPage('/chat', ChatRoute)
    host.registerPage('/deliverables', InventoryRoute)
    host.registerRoute(QUESTS_ROUTE, QuestsRoute)
  },
})
