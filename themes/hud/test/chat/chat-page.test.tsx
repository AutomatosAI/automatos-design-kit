// HUD's /chat as the host gets it: the entry registers HudChat for /chat, the page theme.json declares as its own
// (with Play's keepCorePage list, the one the frame reads to know where the core screen is drawn), and HudChat loads
// the core screen in its own chunk and draws it: the core with Auto, the transcript, the message box and the panels.
import { SDK_VERSION, type ThemeRegistrationHost } from '@automatos/theme-sdk'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { PLACEHOLDER } from '../../src/chat/composer.tsx'
import { AGENTS_TITLE } from '../../src/chat/panels/agents-panel.tsx'
import { DELIVERABLES_TITLE } from '../../src/chat/panels/deliverables-panel.tsx'
import { MISSION_TITLE } from '../../src/chat/panels/mission-panel.tsx'
import { CONVERSATION_LABEL } from '../../src/chat/transcript.tsx'
import { CORE_LABEL } from '../../src/chat/voice-core.tsx'
import hud from '../../src/entry.ts'
import { HudChat } from '../../src/pages/chat.tsx'
import { CHAT_KEEPS_CORE_PAGE } from '../../src/pages/core-screen.ts'
import { readThemeJson } from '../support/files.ts'
import { openChat, stubClips } from './support.tsx'

interface Manifest {
  readonly pages?: Readonly<Record<string, unknown>>
  readonly engines: { readonly automatos: string }
}

const manifest = readThemeJson<Manifest>('theme.json')

function registeredPages(): Map<string, unknown> {
  const pages = new Map<string, unknown>()
  const ignore = (): void => undefined
  const registration: ThemeRegistrationHost = {
    sdkVersion: SDK_VERSION,
    hostVersion: manifest.engines.automatos.replace(/^\^/, ''),
    registerSlot: ignore,
    registerPage: (path, component) => pages.set(path, component),
    registerRoute: ignore,
  }
  hud.register(registration)
  return pages
}

beforeEach(() => {
  host.reset()
  stubClips()
})

describe('/chat', () => {
  it('is a page HUD owns, keeping the core page for the links Play keeps it for', () => {
    expect(manifest.pages).toEqual({ '/chat': { mode: 'own', keepCorePage: ['repo', 'runtime', 'mode'] } })
  })

  it("keeps the core page for exactly the links the frame reads as the host's own chat", () => {
    expect(manifest.pages?.['/chat']).toEqual({ mode: 'own', keepCorePage: [...CHAT_KEEPS_CORE_PAGE] })
  })

  it('is registered with HudChat', () => {
    expect(registeredPages().get('/chat')).toBe(HudChat)
  })

  it('loads the core screen and draws it: the core, the transcript, the box and the panels', async () => {
    openChat()
    render(<HudChat />)
    expect(await screen.findByRole('group', { name: CORE_LABEL })).toBeInTheDocument()
    expect(await screen.findByRole('list', { name: CONVERSATION_LABEL })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: PLACEHOLDER })).toBeInTheDocument()
    for (const title of [AGENTS_TITLE, MISSION_TITLE, DELIVERABLES_TITLE]) {
      expect(screen.getByRole('region', { name: title })).toBeInTheDocument()
    }
  })
})
