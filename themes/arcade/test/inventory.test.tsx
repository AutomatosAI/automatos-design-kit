// Arcade's Inventory (/deliverables) on the harness's Deliverables fake: the bag lists the host's Deliverables newest
// first, each slot an icon, its type, title and date, linked to its own item window; the tabs ask the host's list for
// one type (POSTS only where Socials is offered); an empty bag says so with Auto asleep; ?deliverable=<id> opens that
// item's window, and a link that names none shows the bag with a quiet line. The rows are made up.
import { type Deliverable } from '@automatos/theme-sdk'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { host, WORKSPACE_DEFAULTS } from '@automatos/theme-harness/host'

import { BAG_LABEL, EMPTY_TITLE, TABS_LABEL } from '../src/deliverables/bag.tsx'
import { BAD_LINK, InventoryPage } from '../src/deliverables/inventory-page.tsx'
import { BACK } from '../src/deliverables/item-window.tsx'

const STAMP = '2026-10-14T09:00:00+00:00'

function deliverable(id: string, title: string, artifactType: string, fields: Partial<Deliverable> = {}): Deliverable {
  return {
    id, workspace_id: 'ws-harness', source_type: 'chat', source_id: null, agent_id: null, agent_name: 'Quill', artifact_type: artifactType,
    title, summary: null, storage_type: 'workspace', file_path: `outputs/${id}.md`, file_name: null, file_type: 'md', file_size_bytes: null,
    preview_url: null, preview_type: null, extra: {}, status: 'active', created_at: STAMP, updated_at: STAMP, content: `# ${title}`, ...fields,
  }
}

const ROWS: readonly Deliverable[] = [
  deliverable('d1', 'Laptop shortlist', 'report'),
  deliverable('d2', 'Chemistry revision plan', 'document'),
  deliverable('d3', 'Bake-sale poster', 'image'),
]

const bag = (): HTMLElement => screen.getByRole('region', { name: BAG_LABEL })

beforeEach(() => {
  host.reset()
  host.setReducedMotion(true)
  host.setPathname('/deliverables')
})

describe('the bag', () => {
  it('lists the Deliverables as slots, each linked to its own item window', async () => {
    host.setDeliverables(ROWS)
    render(<InventoryPage />)
    const slots = await within(bag()).findAllByRole('link')
    expect(slots.map((slot) => slot.getAttribute('aria-label'))).toEqual([
      expect.stringMatching(/^Laptop shortlist, Report/),
      expect.stringMatching(/^Chemistry revision plan, Document/),
      expect.stringMatching(/^Bake-sale poster, Image/),
    ])
    expect(slots[0]).toHaveAttribute('href', '/deliverables?deliverable=d1')
    expect(screen.getByText(/3 items · newest first/)).toBeInTheDocument()
  })

  it('asks the host for one type under its tab, and offers POSTS only where Socials is offered', async () => {
    host.setDeliverables(ROWS)
    render(<InventoryPage />)
    const tabs = screen.getByRole('group', { name: TABS_LABEL })
    expect(within(tabs).getAllByRole('button').map((tab) => tab.textContent)).toEqual(['All', 'Reports', 'Documents', 'Images'])
    fireEvent.click(within(tabs).getByRole('button', { name: 'Reports' }))
    expect(within(tabs).getByRole('button', { name: 'Reports' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(host.deliverablesAsked().at(-1)?.filters?.artifact_type).toBe('report'))
  })

  it('shows POSTS where the workspace is offered Socials, asking for what social posts made', async () => {
    host.setWorkspace({ ...WORKSPACE_DEFAULTS, socialsAvailable: true })
    host.setDeliverables(ROWS)
    render(<InventoryPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Posts' }))
    await waitFor(() => expect(host.deliverablesAsked().at(-1)?.filters?.source_type).toBe('social_post'))
  })

  it('says the bag is empty, with Auto asleep and the way to the chat', async () => {
    host.setDeliverables([])
    render(<InventoryPage />)
    expect(await within(bag()).findByText(EMPTY_TITLE)).toBeInTheDocument()
    expect(within(bag()).getByRole('link', { name: 'Go to chat' })).toHaveAttribute('href', '/chat')
  })
})

describe('one item', () => {
  it("opens the item a link names, with its content and the way back to the bag", async () => {
    host.setDeliverables(ROWS)
    host.setSearchParams('deliverable=d1')
    render(<InventoryPage />)
    expect(await screen.findByRole('heading', { name: 'Laptop shortlist' })).toBeInTheDocument()
    expect(screen.getByText(/made by Quill/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: new RegExp(BACK) })).toHaveAttribute('href', '/deliverables')
  })

  it('shows the bag with a quiet line for a link that names no item', async () => {
    host.setDeliverables(ROWS)
    host.setSearchParams('deliverable=../admin')
    render(<InventoryPage />)
    expect(screen.getByRole('status')).toHaveTextContent(BAD_LINK)
  })
})
