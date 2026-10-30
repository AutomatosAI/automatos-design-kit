// Candy's 404 (notFound@1) on the kit's harness: drawn on its own, it names what happened, draws Auto lost as a
// picture the words speak for, offers two ways back (Today and the chat with Auto) through the host's router, and
// takes the active look's roundness itself, since no frame sets it.
import { host } from '@automatos/theme-harness/host'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { BACK_TO_TODAY, CHAT_WITH_AUTO, LOST_AUTO_SIZE, NOT_FOUND_TITLE, NotFound } from '../src/edges/not-found.tsx'

import { TODAY_HREF } from '../src/routes.ts'

beforeEach(() => {
  host.reset()
})

describe('the 404', () => {
  it('says the page is not here and offers Today and the chat', () => {
    render(<NotFound />)
    expect(screen.getByRole('heading', { level: 1, name: NOT_FOUND_TITLE })).toHaveAttribute('data-theme-heading')
    expect(screen.getByRole('link', { name: BACK_TO_TODAY })).toHaveAttribute('href', TODAY_HREF)
    expect(screen.getByRole('link', { name: CHAT_WITH_AUTO })).toHaveAttribute('href', '/chat')
  })

  it("moves the host's router", () => {
    render(<NotFound />)
    fireEvent.click(screen.getByRole('link', { name: BACK_TO_TODAY }))
    expect(host.navigations()).toEqual([{ method: 'push', href: TODAY_HREF }])
  })

  it('draws Auto lost, hidden from screen readers', () => {
    const { container } = render(<NotFound />)
    const auto = container.querySelector('svg[data-state]')
    expect(auto).toHaveAttribute('data-state', 'lost')
    expect(auto).toHaveAttribute('aria-hidden', 'true')
    expect(auto).toHaveAttribute('width', String(LOST_AUTO_SIZE))
  })

})
