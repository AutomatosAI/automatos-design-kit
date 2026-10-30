/**
 * Candy's entry: the module the host loads when automatos/candy is the active theme.
 *
 * It registers what theme.json declares: the frame around every page (which draws its own asleep screen, so asleep@1
 * is listed and the frame polls the backend's health), the look editor (the host's /looks page), the style sheet
 * (/looks/style), the 404, its own /chat and /deliverables, and its own routes, /x/today and /x/agents. Every other
 * page is the host's own, drawn inside the frame on the theme's base (Studio) and recoloured by the palette, whose
 * first paint is data (boot/prepaint.json).
 *
 * The global stylesheet comes first, then the CSS modules the components import: the kit's preset puts them all
 * into dist/theme.css, each rule under html.candy.
 */
import './app/theme.css'

import { defineTheme } from '@automatos/theme-sdk'

import { NotFound } from './edges/not-found'
import { Frame } from './frame/frame'
import { LookEditor } from './looks/look-editor'
import { AgentsRoute, ChatRoute, DeliverablesRoute, TodayRoute } from './pages/pages'
import { AGENTS_ROUTE, TODAY_ROUTE } from './routes'
import { StyleSheet } from './style/style-sheet'

export default defineTheme({
  register(host) {
    host.registerSlot('frame@1', Frame)
    host.registerSlot('lookEditor@1', LookEditor)
    host.registerSlot('styleSheet@1', StyleSheet)
    host.registerSlot('notFound@1', NotFound)
    host.registerPage('/chat', ChatRoute)
    host.registerPage('/deliverables', DeliverablesRoute)
    host.registerRoute(TODAY_ROUTE, TodayRoute)
    host.registerRoute(AGENTS_ROUTE, AgentsRoute)
  },
})
