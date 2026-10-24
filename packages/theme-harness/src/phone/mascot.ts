/**
 * Which of a theme's files shows Auto in a state on the phone: the app's src/styles/mascot/media.ts `mascotMedia` and
 * `themeMedia` (:89-:108, at the Automatos Go commit packages/theme-cli's README names) for an iPhone, where clips
 * play. The clip under `clips` while motion is allowed; the still under `stills`, or under Reduce Motion; nothing for
 * a theme that brings no Auto (Studio shows none either). A state with no still of the theme's keeps the app's own,
 * bundled Auto, which the harness does not carry. No DOM.
 */
import type { PhoneMascot } from '@automatos/theme-cli/phone'

export type MascotShown =
  | { readonly kind: 'none' }
  | { readonly kind: 'clip'; readonly clip: string; readonly still: string }
  | { readonly kind: 'still'; readonly still: string }
  | { readonly kind: 'bundled' }

export function mascotShown(mascot: PhoneMascot | null, state: string, reducedMotion: boolean): MascotShown {
  if (mascot === null) return { kind: 'none' }
  const files = mascot.states.find((entry) => entry.name === state)
  if (files === undefined || files.still === null) return { kind: 'bundled' }
  const clip = mascot.mode === 'clips' && !reducedMotion ? files.clip : null
  return clip === null ? { kind: 'still', still: files.still } : { kind: 'clip', clip, still: files.still }
}
