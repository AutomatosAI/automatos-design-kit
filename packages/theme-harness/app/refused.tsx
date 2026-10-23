/**
 * PRD-261 B-02e: what the harness page draws for a theme folder whose files core would refuse (a theme.json its
 * validator rejects, a preset that is no look, a boot/prepaint.json that is no first-paint table; src/host/register.ts
 * readServedTheme): the reasons, listed instead of the theme; the host's failed status with core's 'manifest' reason
 * on <html>; and a report with nothing drawn, so the shots fail on it.
 */
import { HTML_ATTRS } from '../src/host/prepaint.ts'
import { EMPTY_SERVED, HARNESS_GLOBAL, type HarnessReport } from '../src/host/router.ts'

/** core's ThemeFailureReason for a theme.json it can't read. */
export const MANIFEST_REASON = 'manifest'
const FAILED = 'failed'

const REFUSED: HarnessReport = { status: FAILED, views: [], missing: EMPTY_SERVED, presets: [], minWidth: 0 }
/** What a refused theme publishes for the shots: failed, with nothing drawn. */
export const REFUSED_REPORT: HarnessReport = Object.freeze(REFUSED)

export function Refused({ errors }: { readonly errors: readonly string[] }) {
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

/** <html> and the shots' global for a refused theme: the host's failed status, core's reason, and nothing drawn. */
export function markRefused(win: Window): void {
  const html = win.document.documentElement
  html.setAttribute(HTML_ATTRS.status, FAILED)
  html.setAttribute(HTML_ATTRS.reason, MANIFEST_REASON)
  Reflect.set(win, HARNESS_GLOBAL, REFUSED_REPORT)
}
