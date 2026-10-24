// {{name}} builds with the kit's preset alone, as the Marketplace review rebuilds it: every rule under
// html.{{htmlClass}} (read from theme.json), React and the SDK left to the host's import map, and only src/ in the
// bundle. Add nothing here the build depends on: the review's rebuild never reads this file.
import { defineConfig } from 'vite'
import { automatosTheme } from '@automatos/vite-preset'

export default defineConfig({
  plugins: [automatosTheme()],
})
