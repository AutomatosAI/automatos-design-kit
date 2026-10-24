// HUD builds with the kit's preset alone, as the Marketplace review rebuilds it: every rule under html.hud, React
// and the SDK left to the host's import map, and only src/ in the bundle, with the src/ of the two kit packages
// package.json names under dependencies (@automatos/look-kit and @automatos/mascot).
import { defineConfig } from 'vite'
import { automatosTheme } from '@automatos/vite-preset'

export default defineConfig({
  plugins: [automatosTheme({ htmlClass: 'hud', wrap: 'html' })],
})
