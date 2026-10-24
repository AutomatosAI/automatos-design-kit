import { LookScreen } from '../looks/look-screen'

/**
 * lookEditor@1, the host's /looks page: HUD's LOOK drawer beside its live preview (src/looks/look-screen.tsx), on
 * the SDK's looks area. src/entry.ts registers it under this name.
 */
export function HudLookEditor() {
  return <LookScreen />
}
