import { useMemo } from 'react'

import {
  saveLook,
  useLook,
  useMediaPreferences,
  type HostLook,
  type HostLookResult,
  type HostLookState,
} from '@automatos/theme-sdk'

import { DEFAULT_LOOK } from '../lib/looks/presets'
import { toHudLook, validateHudLook } from '../lib/looks/spec'
import type { HudLook } from '../lib/looks/types'

/**
 * The looks as the LOOK drawer and the style sheet read them, through the SDK's looks area alone: the active look,
 * the user's saved looks, whether they have been read and whether they are kept, the user's reduced-motion setting,
 * and the actions. The host keeps every look and checks each one against looks/schema.json before it takes it; HUD
 * keeps none of its own. The active look and each saved look pass validateHudLook here too, so the drawer only ever
 * reads HUD looks: a look that is not one reads as the default (ARC) and a saved one that is not is left out.
 *
 * Outside a look runtime (a screen drawn on its own) the screens read the default look, already read, and every
 * action comes back refused in the host's own words; nothing changes.
 */

export interface HudLooks {
  /** False outside a look runtime: nothing is kept and every action is refused. */
  readonly available: boolean
  /** False until the host has read the user's looks: the screens show their heading alone until then. */
  readonly loaded: boolean
  /** False once the host can't keep the looks: the drawer says so. */
  readonly persisted: boolean
  /** The user asks for reduced motion (and always on the server): nothing of HUD's moves. */
  readonly reducedMotion: boolean
  readonly look: HudLook
  readonly saved: readonly HudLook[]
  /** Makes `look` the active one, once the host's checks take it; the whole app repaints. */
  readonly pick: (look: HudLook) => HostLookResult
  /** Adds `look` to the saved looks, or replaces the saved look with its id. */
  readonly keep: (look: HudLook) => HostLookResult
  /** Deletes a saved look; deleting the active one goes back to the default look. */
  readonly remove: (id: string) => void
}

function hudLooksOf(saved: readonly HostLook[]): readonly HudLook[] {
  return saved.flatMap((entry) => {
    const result = validateHudLook(entry)
    return result.ok ? [result.look] : []
  })
}

function hudLooks(host: HostLookState, reducedMotion: boolean): HudLooks {
  return {
    available: host.available,
    loaded: host.loaded,
    persisted: host.persisted,
    reducedMotion,
    look: host.look === null ? DEFAULT_LOOK : toHudLook(host.look),
    saved: hudLooksOf(host.saved),
    pick: (look) => host.setLook(look),
    keep: (look) => saveLook(look),
    remove: (id) => host.deleteLook(id),
  }
}

/** The looks, read again whenever the host's look runtime or the motion setting changes. */
export function useHudLooks(): HudLooks {
  const host = useLook()
  const { reducedMotion } = useMediaPreferences()
  return useMemo(() => hudLooks(host, reducedMotion), [host, reducedMotion])
}

/** A look the host took, as a HUD look (it passed looks/schema.json, so it is one). */
export function keptLook(result: Extract<HostLookResult, { readonly ok: true }>): HudLook {
  return toHudLook(result.look)
}
