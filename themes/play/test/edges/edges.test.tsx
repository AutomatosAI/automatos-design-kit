// PRD-260 T-009: the edges of the app under Play: the 404 (Play's notFound@1, "This page wandered off") and
// "Automatos is asleep" (Play's frame while the backend doesn't answer). Moved from core's
// components/play/edges/__tests__/edges.test.tsx and rewritten for the kit's harness: the backend's health is what a
// test sets on the fake host (host.setHealth: connected, checking or down, the API's host, an ask in flight), Check
// again is counted (host.healthChecks()), and the edition and the browser's connection are the fake host's
// (host.setEdition, host.setOnline). Every assertion of what Play draws is kept: the asleep screen only once the host
// says down, in place of the page, Auto asleep, the detail and the countdown; a poll in flight never swaps the page
// out, so what was typed stays; the page mounts again, fresh, only once the host says connected, never on a recheck
// (P260-RVW-1); a frame mounted while it is down opens asleep and never mounts its page (M89); Checking… while a
// check is in flight (M94); offline (M83); the local start command (M84); focus and the gate's live region (M21);
// Auto's reducer (useBackendMascot); and the asleep screen on its own. When /health counts as down (its retries and
// timeouts), which 404 the host draws for a style or a width, and Next's 404 title are the host's;
// test/moved-from-core/shell.json names those tests. Roles, attributes and text only (CSS modules are proxies).
import type { HostHealth } from '@automatos/theme-sdk'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ASLEEP_RECHECK_MS, AWAKE_LINE } from '../../src/components/play/edges/asleep-gate.tsx'
import {
  ASLEEP_TITLE, AsleepScreen, asleepDetail, CHECK_AGAIN, CHECKING, countdownLine, HOSTED_LINE, NOT_CONNECTED, OFFLINE_LINE,
} from '../../src/components/play/edges/asleep-screen.tsx'
import { BACK_TO_CHAT, LOST_LINE, LOST_TITLE } from '../../src/components/play/edges/lost-screen.tsx'
import { COPIED_LABEL, COPY_LABEL, START_COMMAND, START_HINT } from '../../src/components/play/edges/start-command.tsx'
import { useBackendMascot } from '../../src/hooks/use-backend-mascot.ts'
import { SECOND_MS } from '../../src/hooks/use-recheck-countdown.ts'
import { LostScreen as LostSlot, PlayFrameSlot } from '../../src/play-slots.tsx'
import { host, type HealthDetails } from '@automatos/theme-harness/host'

// The frame's own parts have their tests (play-frame.test.tsx, play-sidebar.test.tsx).
vi.mock('../../src/components/play/shell/play-sidebar.tsx', async () => {
  const { createElement } = await import('react')
  return { PlaySidebar: () => createElement('nav', { 'aria-label': 'Main' }) }
})
vi.mock('../../src/components/mascot/auto-mascot.tsx', async () => {
  const { createElement } = await import('react')
  return { AutoMascot: ({ state }: { readonly state: string }) => createElement('div', { 'data-testid': 'auto', 'data-state': state }) }
})

type BackendConnection = HostHealth['connection']

/** The API's host, as the host's health names it. */
const API_HOST = 'localhost'
/** The lost screen's lazy chunk loads on its first render: its first transform in vitest can take a moment. */
const CHUNK_WAIT = Object.freeze({ timeout: 4_000 })
/** The timers the countdown and the copy state use; React's own scheduling stays real. */
const FAKE_TIMERS: Parameters<typeof vi.useFakeTimers>[0] = { toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] }
const DRAFT_LABEL = 'Draft'
const TYPED = 'Half a message, not sent yet'
const mounts = { page: 0 }

/** The page inside the frame, counting its mounts; its draft lives only while it stays mounted. */
function Page() {
  const [draft, setDraft] = useState('')
  useEffect(() => {
    mounts.page += 1
  }, [])
  return (
    <>
      <p>The page</p>
      <input aria-label={DRAFT_LABEL} value={draft} onChange={(event) => setDraft(event.target.value)} />
    </>
  )
}

function renderFrame() {
  return render(
    <PlayFrameSlot>
      <Page />
    </PlayFrameSlot>,
  )
}

/** The host's health from now on, as its /health poll would say it. */
const health = (connection: BackendConnection, details: HealthDetails = {}) => act(() => host.setHealth(connection, details))

const asleepHeading = () => screen.queryByRole('heading', { level: 1, name: ASLEEP_TITLE })
/** Every live status on the page, in order: the asleep screen's pill, then the gate's own region. */
const statusLines = () => screen.getAllByRole('status').map((status) => status.textContent)
const checkAgain = () => fireEvent.click(screen.getByRole('button', { name: CHECK_AGAIN }))

/** Play's frame around the page, then the host says the backend is down: the asleep screen. */
function renderAsleepFrame() {
  renderFrame()
  health('down', { host: API_HOST })
  expect(asleepHeading()).toBeInTheDocument()
}

interface AsleepOptions {
  readonly onCheck?: () => void
  readonly recheckSeconds?: number
  readonly local?: boolean
  readonly checking?: boolean
}

function asleepScreen({ onCheck = vi.fn(), recheckSeconds = 3, local = false, checking = false }: AsleepOptions = {}) {
  return (
    <AsleepScreen
      mascot="sleeping"
      detail={asleepDetail(API_HOST)}
      onCheck={onCheck}
      checking={checking}
      recheckSeconds={recheckSeconds}
      local={local}
    />
  )
}

function renderAsleep(props: AsleepOptions = {}) {
  const onCheck = props.onCheck ?? vi.fn()
  render(asleepScreen({ ...props, onCheck }))
  return onCheck
}

const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

beforeEach(() => {
  host.reset()
  mounts.page = 0
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("the 404 (Play's notFound@1)", () => {
  it("Auto lost, 'This page wandered off' and the way back to /chat, through its lazy slot (P260-FX-23, M17)", async () => {
    render(<LostSlot />)
    expect(await screen.findByRole('heading', { level: 1, name: LOST_TITLE }, CHUNK_WAIT)).toBeInTheDocument()
    expect(LOST_TITLE).toBe('This page wandered off')
    expect(screen.getByText(LOST_LINE)).toBeInTheDocument()
    expect(screen.getByTestId('auto')).toHaveAttribute('data-state', 'lost')
    expect(screen.getByRole('link', { name: BACK_TO_CHAT })).toHaveAttribute('href', '/chat')
  })
})

describe("Play's frame while Automatos is asleep (the host's health)", () => {
  it('shows the asleep screen in place of the page only once the host says down, Auto asleep, never while it checks', () => {
    host.setHealth('checking', { checking: true })
    renderFrame()
    expect(asleepHeading()).not.toBeInTheDocument()
    expect(screen.getByText('The page')).toBeInTheDocument()
    health('down', { host: API_HOST })
    expect(asleepHeading()).toBeInTheDocument()
    expect(screen.queryByText('The page')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
    expect(screen.getByTestId('auto')).toHaveAttribute('data-state', 'sleeping')
    expect(statusLines()).toEqual([NOT_CONNECTED, ASLEEP_TITLE])
    expect(screen.getByText(asleepDetail(API_HOST))).toBeInTheDocument()
    expect(screen.getByText(countdownLine(ASLEEP_RECHECK_MS / SECOND_MS))).toBeInTheDocument()
  })

  it('a poll in flight, or a check after an answer, never shows the asleep screen, and the page keeps what was typed', () => {
    renderFrame()
    fireEvent.change(screen.getByRole('textbox', { name: DRAFT_LABEL }), { target: { value: TYPED } })
    health('connected', { checking: true })
    health('checking')
    health('connected')
    expect(asleepHeading()).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: DRAFT_LABEL })).toHaveValue(TYPED)
    expect(mounts.page).toBe(1)
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
  })

  it('after an answer, the host saying down shows the asleep screen, and only then', () => {
    renderFrame()
    health('connected', { checking: true })
    expect(asleepHeading()).not.toBeInTheDocument()
    expect(screen.getByText('The page')).toBeInTheDocument()
    health('down')
    expect(asleepHeading()).toBeInTheDocument()
    expect(screen.queryByText('The page')).not.toBeInTheDocument()
    expect(screen.getByTestId('auto')).toHaveAttribute('data-state', 'sleeping')
  })

  it('Check again asks the host again, and the page stays away while it asks and while a recheck reads as checking', () => {
    renderAsleepFrame()
    const mountsWhileAsleep = mounts.page
    checkAgain()
    expect(host.healthChecks()).toBe(1)
    health('down', { checking: true })
    health('checking', { checking: true })
    // A recheck of a query that never succeeded reads as loading in react-query: not an answer.
    expect(asleepHeading()).toBeInTheDocument()
    expect(mounts.page).toBe(mountsWhileAsleep)
    expect(screen.queryByText('The page')).not.toBeInTheDocument()
  })

  it('mounts the frame and the page again once the host says connected', () => {
    renderAsleepFrame()
    const mountsWhileAsleep = mounts.page
    checkAgain()
    health('connected', { host: API_HOST })
    expect(screen.getByText('The page')).toBeInTheDocument()
    expect(mounts.page).toBe(mountsWhileAsleep + 1)
    expect(asleepHeading()).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
  })

  it('the automatic recheck asks the host after ASLEEP_RECHECK_MS, and the page mounts again once it answers', () => {
    vi.useFakeTimers(FAKE_TIMERS)
    renderAsleepFrame()
    tick(ASLEEP_RECHECK_MS - SECOND_MS)
    expect(host.healthChecks()).toBe(0)
    tick(SECOND_MS)
    expect(host.healthChecks()).toBe(1)
    health('connected')
    expect(screen.getByText('The page')).toBeInTheDocument()
    expect(asleepHeading()).not.toBeInTheDocument()
  })

  it('mounted while the host says down (browser Back), it opens on the asleep screen and the page never mounts (M89)', () => {
    host.setHealth('down')
    renderFrame()
    expect(asleepHeading()).toBeInTheDocument()
    expect(mounts.page).toBe(0)
    // The new frame's own ask, still down: the page still never mounts.
    health('down', { checking: true })
    health('down')
    expect(asleepHeading()).toBeInTheDocument()
    expect(mounts.page).toBe(0)
  })

  it('Check again says Checking… while the host asks, then counts the full period again (M94)', () => {
    renderAsleepFrame()
    checkAgain()
    health('down', { checking: true })
    expect(screen.getByText(CHECKING)).toBeInTheDocument()
    expect(screen.queryByText(/^Checking again in/)).not.toBeInTheDocument()
    health('down')
    expect(asleepHeading()).toBeInTheDocument()
    expect(screen.getByText('Checking again in 10 seconds.')).toBeInTheDocument()
    expect(countdownLine(ASLEEP_RECHECK_MS / SECOND_MS)).toBe('Checking again in 10 seconds.')
  })

  it('offline while the backend is down: says so, with neither the hosted line nor the start command (M83)', () => {
    renderAsleepFrame()
    expect(screen.getByText(START_COMMAND)).toBeInTheDocument()
    act(() => host.setOnline(false))
    expect(screen.getByText(OFFLINE_LINE)).toBeInTheDocument()
    expect(screen.queryByText(HOSTED_LINE)).not.toBeInTheDocument()
    expect(screen.queryByText(START_COMMAND)).not.toBeInTheDocument()
    expect(asleepHeading()).toBeInTheDocument()
  })

  it("moves focus with the swap and says so: the asleep heading, then the frame's main once it answers (M21)", () => {
    renderFrame()
    expect(statusLines()).toEqual([''])
    health('down')
    expect(asleepHeading()).toHaveFocus()
    expect(statusLines()).toEqual([NOT_CONNECTED, ASLEEP_TITLE])

    checkAgain()
    health('connected')
    expect(screen.getByText('The page')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveFocus()
    expect(document.activeElement).not.toBe(document.body)
    expect(statusLines()).toEqual([AWAKE_LINE])
    expect(AWAKE_LINE).toBe('Automatos is back')
  })

  it('shows the frame and the page, never the asleep screen, while the host says connected, and never asks', () => {
    renderFrame()
    expect(screen.getByText('The page')).toBeInTheDocument()
    health('connected', { checking: true })
    health('connected')
    expect(asleepHeading()).not.toBeInTheDocument()
    expect(screen.getByText('The page')).toBeInTheDocument()
    expect(mounts.page).toBe(1)
    expect(host.healthChecks()).toBe(0)
  })
})

describe('Auto on the asleep screen (useBackendMascot)', () => {
  it('takes backend-down to sleep and backend-up to wake', () => {
    const { result, rerender } = renderHook(({ connection }) => useBackendMascot(connection), {
      initialProps: { connection: 'checking' as BackendConnection },
    })
    expect(result.current).toMatchObject({ mascot: 'idle', asleep: false })
    rerender({ connection: 'down' })
    expect(result.current).toMatchObject({ mascot: 'sleeping', asleep: true })
    rerender({ connection: 'connected' })
    expect(result.current).toMatchObject({ mascot: 'idle', asleep: false })
  })

  it('mounted while the connection is down, Auto is asleep on the first render (M89)', () => {
    const renders: ReturnType<typeof useBackendMascot>[] = []
    const { result } = renderHook(() => {
      const auto = useBackendMascot('down')
      renders.push(auto)
      return auto
    })
    expect(renders[0]).toMatchObject({ mascot: 'sleeping', asleep: true })
    expect(result.current).toMatchObject({ mascot: 'sleeping', asleep: true })
  })
})

describe('the asleep screen', () => {
  it('counts down to the automatic recheck, asks, and starts the count over', () => {
    vi.useFakeTimers(FAKE_TIMERS)
    const onCheck = renderAsleep({ recheckSeconds: 3 })
    expect(screen.getByText('Checking again in 3 seconds.')).toBeInTheDocument()
    tick(SECOND_MS)
    expect(screen.getByText('Checking again in 2 seconds.')).toBeInTheDocument()
    tick(SECOND_MS)
    expect(screen.getByText('Checking again in 1 second.')).toBeInTheDocument()
    expect(onCheck).not.toHaveBeenCalled()
    tick(SECOND_MS)
    expect(onCheck).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Checking again in 3 seconds.')).toBeInTheDocument()
  })

  it('Check again asks at once and starts the count over', () => {
    vi.useFakeTimers(FAKE_TIMERS)
    const onCheck = renderAsleep({ recheckSeconds: 3 })
    tick(2 * SECOND_MS)
    checkAgain()
    expect(onCheck).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Checking again in 3 seconds.')).toBeInTheDocument()
    tick(2 * SECOND_MS)
    expect(onCheck).toHaveBeenCalledTimes(1)
  })

  it('in the local edition names the command that starts Automatos, with Copy', async () => {
    const user = userEvent.setup()
    renderAsleep({ local: true })
    expect(screen.getByText(START_COMMAND)).toBeInTheDocument()
    expect(START_COMMAND).toBe('make up')
    expect(screen.getByText(START_HINT)).toBeInTheDocument()
    expect(START_HINT).toBe('No make? docker compose up -d')
    expect(screen.getByText('automatos-ai')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: COPY_LABEL }))
    expect(await screen.findByRole('button', { name: COPIED_LABEL })).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe(START_COMMAND)
  })

  it('holds the count while a check is in flight, and counts the full period again once it ends (M94)', () => {
    vi.useFakeTimers(FAKE_TIMERS)
    const onCheck = vi.fn()
    const { rerender } = render(asleepScreen({ onCheck, checking: true, recheckSeconds: 3 }))
    expect(screen.getByText(CHECKING)).toBeInTheDocument()
    tick(5 * SECOND_MS)
    expect(onCheck).not.toHaveBeenCalled()
    expect(screen.getByText(CHECKING)).toBeInTheDocument()
    rerender(asleepScreen({ onCheck, checking: false, recheckSeconds: 3 }))
    expect(screen.getByText('Checking again in 3 seconds.')).toBeInTheDocument()
    tick(SECOND_MS)
    expect(screen.getByText('Checking again in 2 seconds.')).toBeInTheDocument()
  })

  it('offline in the local edition: no start command, until the browser is back online (M83)', () => {
    host.setOnline(false)
    renderAsleep({ local: true })
    expect(screen.getByText(OFFLINE_LINE)).toBeInTheDocument()
    expect(screen.queryByText(START_COMMAND)).not.toBeInTheDocument()
    expect(screen.queryByText(HOSTED_LINE)).not.toBeInTheDocument()
    act(() => host.setOnline(true))
    expect(screen.getByText(START_COMMAND)).toBeInTheDocument()
    expect(screen.queryByText(OFFLINE_LINE)).not.toBeInTheDocument()
  })

  it('in the hosted edition offers no command, only that it will come back', () => {
    renderAsleep({ local: false })
    expect(screen.getByText(HOSTED_LINE)).toBeInTheDocument()
    expect(screen.queryByText(START_COMMAND)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: COPY_LABEL })).not.toBeInTheDocument()
  })

  it('says the countdown and the detail in words', () => {
    expect(countdownLine(10)).toBe('Checking again in 10 seconds.')
    expect(countdownLine(1)).toBe('Checking again in 1 second.')
    expect(countdownLine(0)).toBe(CHECKING)
    expect(asleepDetail(API_HOST)).toBe("Automatos didn't answer at localhost.")
    expect(asleepDetail(undefined)).toBe("Automatos didn't answer.")
  })
})
