/**
 * {{name}}'s entry: the module the host loads when {{id}} is the active theme.
 *
 * It registers what theme.json declares: the frame around every page, the look editor (the host's /looks page),
 * the style sheet (/looks/style) and the 404. Every other page is the host's own, drawn inside the frame on the
 * theme's base (Studio) and recoloured by the look, whose first paint is data (boot/prepaint.json).
 *
 * The global stylesheet comes first, then the CSS modules the components import: the kit's preset puts them all
 * into dist/theme.css, each rule under html.{{htmlClass}}.
 */
import './app/theme.css'

import { defineTheme } from '@automatos/theme-sdk'

import { NotFound } from './edges/not-found'
import { Frame } from './frame/frame'
import { LookEditor } from './looks/look-editor'
import { StyleSheet } from './style/style-sheet'

export default defineTheme({
  register(host) {
    host.registerSlot('frame@1', Frame)
    host.registerSlot('lookEditor@1', LookEditor)
    host.registerSlot('styleSheet@1', StyleSheet)
    host.registerSlot('notFound@1', NotFound)
  },
})
