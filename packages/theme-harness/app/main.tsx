/**
 * PRD-261 B-02e: the harness page's script. It starts the fake host as a fresh page of the local edition (src/host.ts
 * reset), names the theme folder's files root (the build serves the folder's assets/ there, so the SDK's assetUrl
 * answers), checks the theme folder's files (src/host/register.ts readServedTheme), reads the settings from the
 * address (src/host/router.ts), and draws the mock host (app/host.tsx). Each change goes back into the address, so a
 * reload, or a shot, opens the same view. Files core would refuse are listed instead of drawn (app/refused.tsx).
 */
import { createRoot } from 'react-dom/client'
import { files, loadEntry } from 'virtual:automatos-harness/theme'
import { host } from '../src/host.ts'
import { readServedTheme } from '../src/host/register.ts'
import { FILES_ROOT, readSettings, settingsQuery, type HarnessSettings } from '../src/host/router.ts'
import { HarnessHost, prepareHost } from './host.tsx'
import { markRefused, Refused } from './refused.tsx'

const ROOT_ID = 'harness'

/** The address for the settings, replacing the current entry (the back button stays the browser's). */
function writeAddress(settings: HarnessSettings): void {
  const { pathname, search } = window.location
  const query = settingsQuery(settings)
  if (query !== search) window.history.replaceState(null, '', `${pathname}${query}`)
}

function boot(): void {
  const element = document.getElementById(ROOT_ID)
  if (element === null) throw new Error(`the harness page has no #${ROOT_ID}`)
  const root = createRoot(element)
  host.reset()
  host.setFilesRoot(FILES_ROOT)
  const served = readServedTheme(files, loadEntry)
  if (!served.ok) {
    markRefused(window)
    root.render(<Refused errors={served.errors} />)
    return
  }
  const settings = readSettings(window.location.search)
  prepareHost(served.theme, settings, window.innerWidth)
  root.render(<HarnessHost theme={served.theme} initial={settings} onSettings={writeAddress} />)
}

boot()
