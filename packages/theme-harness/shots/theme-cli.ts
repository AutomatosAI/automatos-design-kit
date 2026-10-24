/**
 * The theme CLI's executable, for the Playwright configs whose web server is `automatos-theme dev`: the dev smoke
 * (dev-smoke.config.ts, over Play) and the phone view's shots (phone-shots.config.ts, over the made-up phone skin).
 */
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

/** The theme CLI's executable, from the kit's install (its package.json `bin`). */
export function themeCli(): string {
  const require = createRequire(import.meta.url)
  const manifest = require.resolve('@automatos/theme-cli/package.json')
  const { bin } = require('@automatos/theme-cli/package.json') as { readonly bin: { readonly 'automatos-theme': string } }
  return join(dirname(manifest), bin['automatos-theme'])
}
