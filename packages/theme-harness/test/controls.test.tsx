// PRD-261 B-02b: the fake host's controls (src/host.ts) reach a rendered component through the SDK, as the
// host's own state reaches a theme: the workspace, the roles, the edition, the tone, the backend's health,
// the media preferences and the storage area's readiness each render again when a test sets them, and
// host.reset() puts each back. The router, the links and the notices are spies a test reads back.
import {
  HostLink, notify, readThemeState, useEdition, useHealth, useHostPathname, useHostRouter, useLook, useLookScope,
  useMediaPreferences, useRole, useThemeLayout, useThemeState, useTone, useWorkspace, writeThemeState, type HostRouter,
} from '@automatos/theme-sdk'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { host, STORAGE_DEFAULTS, WORKSPACE_DEFAULTS } from '../src/host.ts'

const PROBE_KEY = 'probe'
const LOOK = Object.freeze({ schema: 'example-look/v1', id: 'calm', name: 'Calm', sub: 'Soft and quiet' })

/** What a theme can know about where it is drawn, one line per value, read through the SDK. */
function Probe() {
  const { workspace } = useWorkspace()
  const role = useRole()
  const health = useHealth()
  const state = useThemeState(PROBE_KEY)
  return (
    <dl>
      <dt>workspace</dt><dd data-testid="workspace">{workspace === null ? 'none' : `${workspace.name}:${String(workspace.socialsAvailable)}`}</dd>
      <dt>role</dt><dd data-testid="role">{`${role.workspaceRole}:${String(role.canEdit)}`}</dd>
      <dt>edition</dt><dd data-testid="edition">{useEdition()}</dd>
      <dt>tone</dt><dd data-testid="tone">{useTone() ?? 'unknown'}</dd>
      <dt>health</dt><dd data-testid="health">{health.connection}</dd>
      <dt>motion</dt><dd data-testid="motion">{useMediaPreferences().reducedMotion ? 'reduced' : 'full'}</dd>
      <dt>layout</dt><dd data-testid="layout">{useThemeLayout()}</dd>
      <dt>storage</dt><dd data-testid="storage">{`${String(state.ready)}:${String(state.persisted)}:${String(state.value)}`}</dd>
      <dt>scope</dt><dd data-testid="scope">{useLookScope() ?? 'none'}</dd>
    </dl>
  )
}

const shown = (id: string): string | null => screen.getByTestId(id).textContent

beforeEach(() => {
  host.reset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the context controls, read back through the SDK', () => {
  it('start as the local edition, its operator, in the default workspace, light, up, with motion, at a desktop width', () => {
    render(<Probe />)
    expect(shown('workspace')).toBe(`${WORKSPACE_DEFAULTS.name}:false`)
    expect(shown('role')).toBe('owner:true')
    expect(shown('edition')).toBe('local')
    expect(shown('tone')).toBe('light')
    expect(shown('health')).toBe('connected')
    expect(shown('motion')).toBe('full')
    expect(shown('layout')).toBe('theme')
    expect(shown('scope')).toBe(`${WORKSPACE_DEFAULTS.id}:${STORAGE_DEFAULTS.userKey}`)
  })

  it('render again with what a test sets: workspace, role, edition, tone, health, media preferences and width', () => {
    render(<Probe />)
    act(() => {
      host.setWorkspace({ name: 'Second workspace', socialsAvailable: true })
      host.setRole({ workspaceRole: 'viewer', canEdit: false })
      host.setEdition('saas')
      host.setTone('dark')
      host.setHealth('down')
      host.setReducedMotion(true)
      host.setWidth(800)
    })
    expect(shown('workspace')).toBe('Second workspace:true')
    expect(shown('role')).toBe('viewer:false')
    expect(shown('edition')).toBe('saas')
    expect(shown('tone')).toBe('dark')
    expect(shown('health')).toBe('down')
    expect(shown('motion')).toBe('reduced')
    expect(shown('layout')).toBe('fallback')
    act(() => host.setWorkspace(null))
    expect(shown('workspace')).toBe('none')
    expect(shown('scope')).toBe('none')
  })

  it('let a look runtime force the tone, and the reset put every control back', () => {
    const { unmount } = render(<Probe />)
    act(() => host.setLooks({ look: LOOK, tone: 'dark' }))
    expect(shown('tone')).toBe('dark')
    act(() => {
      host.setTone('light')
      host.setWidth(null)
    })
    expect(shown('tone')).toBe('dark')
    expect(shown('layout')).toBe('pending')
    unmount()
    host.reset()
    render(<Probe />)
    expect([shown('tone'), shown('layout'), shown('health')]).toEqual(['light', 'theme', 'connected'])
  })
})

describe('the storage controls, read back through the SDK', () => {
  it("make reads not ready and writes refused while the host isn't ready, and ready again after", () => {
    render(<Probe />)
    expect(shown('storage')).toBe('true:true:null')
    act(() => host.setStorage({ ready: false }))
    expect(shown('storage')).toBe('false:false:null')
    expect(writeThemeState(PROBE_KEY, 1)).toMatchObject({ ok: false, reason: 'not-ready' })
    act(() => host.setStorage({ ready: true }))
    act(() => {
      writeThemeState(PROBE_KEY, 2)
    })
    expect(shown('storage')).toBe('true:true:2')
  })

  it('keep state in memory, not persisted, while the browser blocks its storage, with one warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    host.setStorage({ persisted: false })
    render(<Probe />)
    act(() => {
      writeThemeState(PROBE_KEY, 'kept')
    })
    expect(shown('storage')).toBe('true:false:kept')
    expect(readThemeState(PROBE_KEY)).toMatchObject({ ready: true, value: 'kept' })
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it("follow the context's workspace, as the host's scope does", () => {
    host.setWorkspace(null)
    expect(readThemeState(PROBE_KEY, { within: 'workspace' }).ready).toBe(false)
    host.setWorkspace({ id: 'workspace-2' })
    expect(writeThemeState(PROBE_KEY, true, { within: 'workspace' })).toEqual({ ok: true, persisted: true })
  })
})

describe('the spies', () => {
  let router: HostRouter | null = null

  function Nav() {
    router = useHostRouter()
    return (
      <nav>
        <span data-testid="path">{useHostPathname()}</span>
        <HostLink href="/chat?chatId=7">Chat</HostLink>
        <HostLink href="https://docs.example.com">Docs</HostLink>
        <button type="button" onClick={() => router?.replace('/looks')}>Looks</button>
      </nav>
    )
  }

  it('keep each navigation, and move the fake URL', () => {
    render(<Nav />)
    fireEvent.click(screen.getByRole('link', { name: 'Chat' }))
    expect(shown('path')).toBe('/chat')
    fireEvent.click(screen.getByRole('button', { name: 'Looks' }))
    expect(host.navigations()).toEqual([{ method: 'push', href: '/chat?chatId=7' }, { method: 'replace', href: '/looks' }])
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('target', '_blank')
    expect(() => router?.push('//elsewhere.example.com')).toThrow(TypeError)
    expect(host.navigations()).toHaveLength(2)
  })

  it('keep each notice as checked, and refuse a malformed one', () => {
    const id = notify({ kind: 'success', title: 'Saved' })
    expect(host.notices()).toEqual([{ id, kind: 'success', title: 'Saved', dismissed: false }])
    expect(() => notify({ title: ' ' })).toThrow(TypeError)
  })

  it('give a look runtime its state and actions, and none outside one', () => {
    function Looks() {
      const looks = useLook()
      return <output>{looks.available ? `${looks.look?.name}:${looks.saved.length}` : 'none'}</output>
    }
    render(<Looks />)
    expect(screen.getByRole('status')).toHaveTextContent('none')
    act(() => host.setLooks({ look: LOOK, saved: [LOOK] }))
    expect(screen.getByRole('status')).toHaveTextContent('Calm:1')
  })
})
