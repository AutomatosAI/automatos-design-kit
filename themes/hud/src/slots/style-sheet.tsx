import { StyleScreen } from '../style/style-screen'

/**
 * styleSheet@1, the host's /looks/style page: what the active look paints, HUD's variables and Studio's tokens, its
 * contrast, type and components (src/style/style-screen.tsx). src/entry.ts registers it under this name.
 */
export function HudStyleSheet() {
  return <StyleScreen />
}
