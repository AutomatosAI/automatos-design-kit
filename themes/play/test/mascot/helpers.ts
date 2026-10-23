/**
 * PRD-260 — replays mascot events and records what Auto shows after each one.
 *
 * Moved from core's lib/mascot/__tests__/helpers.ts as it was, but for its imports: the reducer
 * from the theme's source and a receipt in the SDK's shape (HostReceipt, the shape of core's
 * Receipt); and, for the tests that check Auto's file URLs, where the fake host serves the
 * package's files from (core served Auto's from /auto/).
 */
import type { HostReceipt } from '@automatos/theme-sdk'

import { INITIAL_MASCOT, mascotReducer } from '../../src/lib/mascot/reducer.ts'
import type { MascotEvent, MascotName, MascotState } from '../../src/lib/mascot/types.ts'

/** Where the fake host serves the package's files from (host.setFilesRoot), as core's host names them. */
export const FILES_ROOT = '/api/themes/files/0123abcd/'
/** Where Auto's clips and stills sit under it: the package's assets/mascot/ (lib/mascot/media.ts). */
export const MASCOT_FILES = `${FILES_ROOT}assets/mascot/`

export function replay(events: readonly MascotEvent[], from: MascotState = INITIAL_MASCOT): MascotState {
  return events.reduce(mascotReducer, from)
}

/** The states shown after each event, with repeats (and the starting state) dropped. */
export function sequence(events: readonly MascotEvent[], from: MascotState = INITIAL_MASCOT): MascotName[] {
  const shown = events.reduce<{ state: MascotState; names: readonly MascotName[] }>(
    (acc, event) => {
      const state = mascotReducer(acc.state, event)
      const last = acc.names.length > 0 ? acc.names[acc.names.length - 1] : from.mascot
      return { state, names: state.mascot === last ? acc.names : [...acc.names, state.mascot] }
    },
    { state: from, names: [] },
  )
  return [...shown.names]
}

/** Freeze a value and everything in it, so a mutating reducer throws in strict mode. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    Object.values(value).forEach(deepFreeze)
  }
  return value
}

/** A receipt in the SDK's shape (HostReceipt; core's types/chat.ts Receipt). */
export function receipt(status: HostReceipt['status'], fields: Partial<HostReceipt> = {}): HostReceipt {
  return { action: 'a', kind: 'read', status, subject: 's', effect: 'e', link: null, reason: null, ...fields }
}
