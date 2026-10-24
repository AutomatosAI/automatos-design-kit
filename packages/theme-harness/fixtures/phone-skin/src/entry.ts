/**
 * The phone skin sample's entry: a made-up theme the phone view's shots draw (shots/phone-shots.config.ts serves it with
 * `automatos-theme dev`). A phone draws a theme from its theme.json `mobile` block alone and never loads this module,
 * but the harness builds a theme folder's entry with its page, so this one registers the three slots theme.json
 * declares, each a plain element. Plain `.ts`, so no JSX: React's createElement draws them.
 */
import { createElement, type ReactNode } from 'react'
import { defineTheme } from '@automatos/theme-sdk'

function Frame({ children }: { readonly children?: ReactNode }) {
  return createElement('div', { 'data-sample': 'frame' }, children)
}

function LookEditor() {
  return createElement('p', null, 'This sample has no looks to edit.')
}

function StyleSheet() {
  return createElement('p', null, 'This sample keeps its colours in its mobile block.')
}

export default defineTheme({
  register(host) {
    host.registerSlot('frame@1', Frame)
    host.registerSlot('lookEditor@1', LookEditor)
    host.registerSlot('styleSheet@1', StyleSheet)
  },
})
