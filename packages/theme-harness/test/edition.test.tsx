// The harness's edition, in jsdom: the local edition by default (src/host.ts reset, DEFAULT_SETTINGS), and the hosted
// one, SaaS, when the address says `edition=saas` (src/host/router.ts readSettings, app/host.tsx prepareHost): the
// switch the showcase shots draw with (src/host/showcase.ts). Core draws its first-run nudge on the local edition only,
// so a chat the harness draws on SaaS has none, and one drawn on the default still has it. A sample theme (made-up
// data) draws the edition it reads and the host's nudge on its /chat page.
import { defineTheme, FirstRunNudge, useEdition, type ThemeRegistrationHost } from '@automatos/theme-sdk'
import type { ThemePackageManifest } from '@automatos/theme-cli/manifest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { HarnessHost, prepareHost } from '../app/host.tsx'
import { host } from '../src/host.ts'
import type { HarnessTheme } from '../src/host/register.ts'
import { DEFAULT_SETTINGS, EDITIONS, readSettings, settingsQuery, type HarnessSettings } from '../src/host/router.ts'
import { NUDGE_LINE } from '../src/sdk/cards/chrome.tsx'

const MANIFEST: ThemePackageManifest = {
  schema: 'automatos-theme/v1', id: 'example/edition', name: 'Edition', version: '1.0.0',
  engines: { automatos: '^1.1.0', sdk: '^1.1.0' }, base: 'studio', htmlClass: 'edition', minWidth: 1024, tone: 'light',
  slots: ['frame@1'], pages: { '/chat': { mode: 'own' } },
}
const NUDGE = '[data-protected-surface="first-run-nudge"]'

function Frame({ children }: { readonly children?: ReactNode }) {
  return <div data-testid="frame">{children}</div>
}

function ChatPage() {
  return (
    <>
      <p data-testid="edition">{useEdition()}</p>
      <FirstRunNudge />
    </>
  )
}

function register(registration: ThemeRegistrationHost): void {
  registration.registerSlot('frame@1', Frame)
  registration.registerPage('/chat', ChatPage)
}

const THEME: HarnessTheme = {
  manifest: MANIFEST, presets: [], prepaint: null, loadEntry: () => Promise.resolve({ default: defineTheme({ register }) }),
}

/** The harness on /chat as main.tsx starts it, with these settings; resolves once the theme's page is drawn. */
async function drawChat(changes: Partial<HarnessSettings> = {}): Promise<HTMLElement> {
  const settings: HarnessSettings = { ...DEFAULT_SETTINGS, path: '/chat', width: 1440, ...changes }
  prepareHost(THEME, settings, window.innerWidth)
  render(<HarnessHost theme={THEME} initial={settings} />)
  return screen.findByTestId('edition')
}

beforeEach(() => {
  host.reset()
})

describe("the harness's edition", () => {
  it("is the local edition unless the address says `edition=saas`; any other value is the default's", () => {
    expect(EDITIONS).toEqual(['local', 'saas'])
    expect(DEFAULT_SETTINGS.edition).toBe('local')
    expect(readSettings('').edition).toBe('local')
    expect(readSettings('?edition=saas').edition).toBe('saas')
    expect(readSettings('?edition=hosted').edition).toBe('local')
    expect(settingsQuery({ ...DEFAULT_SETTINGS, edition: 'saas' })).toBe('?edition=saas')
    expect(settingsQuery({ ...DEFAULT_SETTINGS, edition: 'local' })).toBe('')
  })

  it('draws the chat on the local edition by default, with core\'s first-run nudge over it', async () => {
    expect(await drawChat()).toHaveTextContent('local')
    expect(document.querySelector(NUDGE)).not.toBeNull()
    expect(screen.getByText(NUDGE_LINE)).toBeInTheDocument()
  })

  it('draws the chat on the hosted edition for `edition=saas`, with no first-run nudge', async () => {
    expect(await drawChat({ edition: readSettings('?edition=saas').edition })).toHaveTextContent('saas')
    expect(document.querySelector(NUDGE)).toBeNull()
    expect(screen.queryByText(NUDGE_LINE)).toBeNull()
  })

  it('sets the edition from the settings each time the host is prepared, so a SaaS page leaves no SaaS behind', async () => {
    prepareHost(THEME, { ...DEFAULT_SETTINGS, edition: 'saas' }, window.innerWidth)
    expect(await drawChat()).toHaveTextContent('local')
    expect(document.querySelector(NUDGE)).not.toBeNull()
  })
})
