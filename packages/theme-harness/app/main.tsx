/**
 * PRD-261 B-02e: the harness page's script. It starts the fake host as a fresh page of the local edition (src/host.ts
 * reset; `edition=saas` in the address makes it the hosted one, in app/host.tsx prepareHost), names the theme folder's
 * files root (the build serves the folder's assets/ there, so the SDK's assetUrl answers), checks the theme folder's
 * files (src/host/register.ts readServedTheme), reads the settings from the address (src/host/router.ts), gives the page
 * areas' reads their made-up answers (src/host/sample-data.ts), and draws the mock host (app/host.tsx). Each change goes back into the address, so a reload, or a shot, opens the same view.
 * Files core would refuse are listed instead of drawn (app/refused.tsx).
 *
 * On PHONE_PATH it draws the phone view instead (app/phone/page.tsx): what Automatos Go draws for the theme, with its
 * own settings in the address (src/phone/settings.ts).
 */
import { createRoot, type Root } from 'react-dom/client'
import { assets, files, loadEntry } from 'virtual:automatos-harness/theme'
import { host } from '../src/host.ts'
import { readServedTheme, type HarnessTheme } from '../src/host/register.ts'
import { FILES_ROOT, PHONE_PATH, readSettings, settingsQuery, type HarnessSettings } from '../src/host/router.ts'
import { giveSampleData } from '../src/host/sample-data.ts'
import { phoneQuery, readPhoneSettings, type PhoneSettings } from '../src/phone/settings.ts'
import { HarnessHost, prepareHost } from './host.tsx'
import { PhonePage } from './phone/page.tsx'
import { markRefused, Refused } from './refused.tsx'

const ROOT_ID = 'harness'

/** The address for a query, replacing the current entry (the back button stays the browser's). */
function writeQuery(query: string): void {
  const { pathname, search } = window.location
  if (query !== search) window.history.replaceState(null, '', `${pathname}${query}`)
}

const writeAddress = (settings: HarnessSettings): void => writeQuery(settingsQuery(settings))
const writePhoneAddress = (settings: PhoneSettings): void => writeQuery(phoneQuery(settings))

function drawPhone(root: Root, theme: HarnessTheme): void {
  const settings = readPhoneSettings(window.location.search)
  root.render(<PhonePage theme={theme} assets={assets} initial={settings} onSettings={writePhoneAddress} />)
}

function drawHost(root: Root, theme: HarnessTheme): void {
  const settings = readSettings(window.location.search)
  giveSampleData()
  prepareHost(theme, settings, window.innerWidth)
  root.render(<HarnessHost theme={theme} initial={settings} onSettings={writeAddress} />)
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
  if (window.location.pathname === PHONE_PATH) drawPhone(root, served.theme)
  else drawHost(root, served.theme)
}

boot()
