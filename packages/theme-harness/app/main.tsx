/**
 * PRD-261 B-02e: the harness page's script. It starts the fake host as a fresh page of the local edition (src/host.ts
 * reset), names the theme folder's files root (the build serves the folder's assets/ there, so the SDK's assetUrl
 * answers), checks the theme folder's files (src/host/register.ts readServedTheme), reads the settings from the
 * address (src/host/router.ts), and draws the mock host (app/host.tsx). Each change goes back into the address, so a
 * reload, or a shot, opens the same view. A theme.json core would refuse is listed instead of drawn.
 */
import { createRoot } from 'react-dom/client'
import { files, loadEntry } from 'virtual:automatos-harness/theme'
import { host } from '../src/host.ts'
import { HTML_ATTRS } from '../src/host/prepaint.ts'
import { readServedTheme } from '../src/host/register.ts'
import { FILES_ROOT, HARNESS_GLOBAL, readSettings, settingsQuery, type HarnessReport, type HarnessSettings } from '../src/host/router.ts'
import { HarnessHost, prepareHost } from './host.tsx'

const ROOT_ID = 'harness'
/** core's ThemeFailureReason for a theme.json it can't read. */
const MANIFEST_REASON = 'manifest'

/** The address for the settings, replacing the current entry (the back button stays the browser's). */
function writeAddress(settings: HarnessSettings): void {
  const { pathname, search } = window.location
  const query = settingsQuery(settings)
  if (query !== search) window.history.replaceState(null, '', `${pathname}${query}`)
}

function Refused({ errors }: { readonly errors: readonly string[] }) {
  return (
    <main style={{ padding: '32px', fontFamily: 'system-ui, sans-serif', color: '#1a1a1a', background: '#ffffff' }}>
      <h1 style={{ fontSize: '24px' }}>The harness can&apos;t load this theme</h1>
      <p>The Automatos server would refuse its files:</p>
      <ul>
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </main>
  )
}

function refuse(root: ReturnType<typeof createRoot>, errors: readonly string[]): void {
  const html = document.documentElement
  html.setAttribute(HTML_ATTRS.status, 'failed')
  html.setAttribute(HTML_ATTRS.reason, MANIFEST_REASON)
  const report: HarnessReport = { status: 'failed', views: [], presets: [], minWidth: 0 }
  Reflect.set(window, HARNESS_GLOBAL, Object.freeze(report))
  root.render(<Refused errors={errors} />)
}

function boot(): void {
  const element = document.getElementById(ROOT_ID)
  if (element === null) throw new Error(`the harness page has no #${ROOT_ID}`)
  const root = createRoot(element)
  host.reset()
  host.setFilesRoot(FILES_ROOT)
  const served = readServedTheme(files, loadEntry)
  if (!served.ok) {
    refuse(root, served.errors)
    return
  }
  const settings = readSettings(window.location.search)
  prepareHost(served.theme, settings, window.innerWidth)
  root.render(<HarnessHost theme={served.theme} initial={settings} onSettings={writeAddress} />)
}

boot()
