'use client'

import { accentLikeText } from '../../lib/looks/accent-like-text'
import { usePlayLook } from './use-play-look'

/**
 * Play 1.1.1 — whether the active look's accent reads as its text colour (lib/looks/accent-like-text.ts), as the
 * frame and the asleep screen mark it: data-accent-like-text turns the secondary buttons into outlines.
 */
export function useAccentLikeText(): boolean {
  return accentLikeText(usePlayLook().look)
}
