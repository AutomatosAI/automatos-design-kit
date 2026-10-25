// Play 1.1.1: the sidebar on a laptop's window. The whole sidebar scrolled, so Docs, Settings and the connection pill
// fell off the bottom; now the nav and Recent scroll between New chat and the foot, which stays in view, and Recent's
// own list scrolls in what the nav leaves. Recent lines up with the nav (space-5 in), a title on one line with an
// ellipsis, its whole title still the link's name. The parts are roles in the DOM; how they lay out is the
// stylesheet's text (css: false), read here.
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { PlaySidebar } from '../../src/components/play/shell/play-sidebar.tsx'
import { host } from '@automatos/theme-harness/host'
import { declaredFor } from '../support/rule-values.ts'

const SIDEBAR_CSS = 'components/play/shell/play-sidebar.module.css'
const LONG_TITLE = 'Ola Auto, testing the new layout with a title far longer than the sidebar is wide'
const NAV_INSET = 'var(--pl-space-5)'

beforeEach(() => {
  host.reset()
  host.setConversations([{ id: 'c1', title: LONG_TITLE, updatedAt: '2026-10-14T09:00:00Z', preview: null }])
})

describe('the sidebar on a short window (Play 1.1.1)', () => {
  it('scrolls the nav and Recent together, and keeps Docs, Settings and the pill outside that part', async () => {
    render(<PlaySidebar />)
    const recent = await screen.findByRole('region', { name: 'Recent' })
    const scroller = screen.getByRole('navigation', { name: 'Main' }).parentElement as HTMLElement
    expect(scroller).toContainElement(recent)
    expect(scroller).not.toContainElement(screen.getByRole('list', { name: 'More' }))
    expect(scroller).not.toContainElement(screen.getByRole('status'))
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toContainElement(screen.getByRole('link', { name: 'Docs' }))
  })

  it('never scrolls the sidebar itself: the middle scrolls, Recent scrolls its list, the foot is pinned', () => {
    expect(declaredFor(SIDEBAR_CSS, '.sidebar').get('overflow')).toBe('hidden')
    const scroller = declaredFor(SIDEBAR_CSS, '.scroller')
    expect([scroller.get('flex'), scroller.get('min-height'), scroller.get('overflow-y')]).toEqual(['1 1 0', '0', 'auto'])
    expect(declaredFor(SIDEBAR_CSS, '.recent').get('flex')).toBe('1 1 0')
    const list = declaredFor(SIDEBAR_CSS, '.recentList')
    expect([list.get('min-height'), list.get('overflow-y')]).toEqual(['0', 'auto'])
    expect(declaredFor(SIDEBAR_CSS, '.foot').get('flex')).toBe('none')
    expect(declaredFor(SIDEBAR_CSS, '.navGroups').get('flex')).toBe('none')
  })

  it("lines Recent up with the nav: its label and its links start space-5 in, as the nav's do", () => {
    const inset = (padding: string | undefined) => padding?.split(' ')[3]
    expect(inset(declaredFor(SIDEBAR_CSS, '.navLink').get('padding'))).toBe(NAV_INSET)
    expect(inset(declaredFor(SIDEBAR_CSS, '.recentLink').get('padding'))).toBe(NAV_INSET)
    expect(inset(declaredFor(SIDEBAR_CSS, '.groupLabel').get('padding'))).toBe(NAV_INSET)
    expect(inset(declaredFor(SIDEBAR_CSS, ':global(html.play) .sectionLabel').get('padding'))).toBe(NAV_INSET)
  })

  it('shows a long title on one line with an ellipsis, the whole title still the link name', async () => {
    render(<PlaySidebar />)
    const recent = await screen.findByRole('region', { name: 'Recent' })
    const link = within(recent).getByRole('link', { name: LONG_TITLE })
    expect(link.children).toHaveLength(1)
    expect(link.firstElementChild).toHaveTextContent(LONG_TITLE)
    const title = declaredFor(SIDEBAR_CSS, '.recentTitle')
    expect([title.get('white-space'), title.get('overflow'), title.get('text-overflow'), title.get('min-width')]).toEqual([
      'nowrap', 'hidden', 'ellipsis', '0',
    ])
  })
})
