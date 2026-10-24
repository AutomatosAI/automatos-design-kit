// src/entry.ts is the module the host imports: its default export, made by the harness's defineTheme, registers
// against a host shaped as core's loader hands one over (one component per key, the SDK's and the host contract's
// versions), and what it registers is what theme.json declares. The frame it registers draws a page.
import { SDK_VERSION, type ThemeRegistrationHost } from '@automatos/theme-sdk'
import { render, screen } from '@testing-library/react'
import type { ComponentType, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import hud from '../src/entry.ts'
import { readThemeJson } from './support/files.ts'

interface Manifest {
  readonly slots: readonly string[]
  readonly pages?: Readonly<Record<string, unknown>>
  readonly routes?: readonly string[]
  readonly engines: { readonly automatos: string }
}

type Kind = 'slot' | 'page' | 'route'

const manifest = readThemeJson<Manifest>('theme.json')
const HOST_VERSION = manifest.engines.automatos.replace(/^\^/, '')

function registerAll(): Readonly<Record<Kind, Map<string, unknown>>> {
  const got: Record<Kind, Map<string, unknown>> = { slot: new Map(), page: new Map(), route: new Map() }
  const add = (kind: Kind) => (key: string, component: unknown) => {
    if (got[kind].has(key)) throw new Error(`${kind} ${key} registered twice`)
    got[kind].set(key, component)
  }
  const registration: ThemeRegistrationHost = {
    sdkVersion: SDK_VERSION, hostVersion: HOST_VERSION,
    registerSlot: add('slot'), registerPage: add('page'), registerRoute: add('route'),
  }
  hud.register(registration)
  return got
}

beforeEach(() => {
  host.reset()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
})

describe("HUD's entry", () => {
  it('registers exactly the slots, pages and routes theme.json declares, each once', () => {
    const got = registerAll()
    expect([...got.slot.keys()].sort()).toEqual([...manifest.slots].sort())
    expect([...got.page.keys()].sort()).toEqual(Object.keys(manifest.pages ?? {}).sort())
    expect([...got.route.keys()]).toEqual([...(manifest.routes ?? [])])
  })

  it('registers a frame that draws the page in its main', () => {
    const Frame = registerAll().slot.get('frame@1') as ComponentType<{ readonly children?: ReactNode }>
    render(<Frame><p>Inside the frame</p></Frame>)
    expect(screen.getByRole('main')).toHaveTextContent('Inside the frame')
  })
})
