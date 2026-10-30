import { AutoSprite } from '../art/pixel-art'

/**
 * empty-state.mascot@1: Auto asleep in place of the icon of the host's shared empty state, on the pages that draw it
 * (mascot-placement.md: under Studio, the Deliverables Templates tab when empty, and host pages Arcade doesn't
 * replace). The heading and the line under it stay the host's; Auto is decoration beside them.
 */

export interface EmptyStateProps {
  readonly base?: 'studio' | 'classic'
  readonly title?: string
  readonly description?: string
}

export function EmptyStateAuto({ base = 'studio' }: EmptyStateProps) {
  return <AutoSprite state="sleeping" view={base === 'studio' ? 'phone' : 'mark'} />
}
