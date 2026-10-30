import { saveLook, useLook, type HostLook, type HostLookResult } from '@automatos/theme-sdk'
import { useMemo } from 'react'

import { DEFAULT_LOOK, type ThemeLook } from './spec'

/**
 * The looks as the editor and the style sheet read them, through the SDK's looks area alone: the active look, the
 * user's saved looks, whether they have loaded and whether this browser keeps them, and the actions. Every look the
 * host's runtime hands back passed this theme's looks/schema.json, so it is a ThemeLook.
 *
 * Outside a look runtime (a screen drawn on its own) the screens read the default look, already loaded, and every
 * action comes back refused in the host's own words; nothing changes.
 */

export interface ThemeLooks {
  /** False outside a look runtime: nothing is kept and every action refuses. */
  readonly available: boolean
  readonly loaded: boolean
  readonly persisted: boolean
  readonly look: ThemeLook
  readonly saved: readonly ThemeLook[]
  /** Makes `look` the active one, once the host's checks take it. */
  readonly pick: (look: ThemeLook) => HostLookResult
  /** Adds `look` to the saved looks (or replaces the saved look with its id). */
  readonly keep: (look: ThemeLook) => HostLookResult
  /** Gives a saved look a new name, once the host's checks take it. */
  readonly rename: (id: string, name: string) => HostLookResult
  /** Deletes a saved look; deleting the active one goes back to the theme's default. */
  readonly remove: (id: string) => void
}

const asThemeLook = (look: HostLook): ThemeLook => look as ThemeLook

export function useThemeLooks(): ThemeLooks {
  const host = useLook()
  return useMemo(() => {
    const active = host.available ? host.look : null
    return {
      available: active !== null,
      loaded: host.loaded,
      persisted: host.persisted,
      look: active === null ? DEFAULT_LOOK : asThemeLook(active),
      saved: host.saved.map(asThemeLook),
      pick: (look: ThemeLook) => host.setLook(look),
      keep: (look: ThemeLook) => saveLook(look),
      rename: (id: string, name: string) => host.renameLook(id, name),
      remove: (id: string) => host.deleteLook(id),
    }
  }, [host])
}
