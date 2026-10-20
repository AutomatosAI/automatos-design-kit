// Play builds with the kit's preset alone, as the Marketplace review rebuilds it: every rule under
// html.play (D2-c, so Play's cascade over Studio's rules stays as it is in core), React and the SDK
// left to the host's import map, and only src/ in the bundle.
import { defineConfig } from 'vite'
import { automatosTheme } from '@automatos/vite-preset'

export default defineConfig({
  plugins: [automatosTheme({ htmlClass: 'play', wrap: 'html' })],
})
