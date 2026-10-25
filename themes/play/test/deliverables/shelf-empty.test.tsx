// Play 1.1.1: the empty Deliverables shelf. The tiny Auto in the header and a line of small text looked unfinished;
// now an empty shelf (or an empty chip) has no header Auto, and one centred block: Auto at his regular size with the
// empty message as his caption, then Start a chat. A shelf with cards keeps Auto in its header. Auto is a stand-in
// showing his state, size and caption; the block's layout is the stylesheet's text (css: false).
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AutoMascotProps } from '../../src/components/mascot/auto-mascot.tsx'
import { SHELF_TITLE, ShelfScreen } from '../../src/components/play/deliverables/play-shelf.tsx'
import { START_A_CHAT } from '../../src/components/play/deliverables/shelf-body.tsx'
import { ALL_FILTER, emptyMessage } from '../../src/lib/play/shelf.ts'
import { host } from '@automatos/theme-harness/host'
import { answer, page, ROWS } from '../support/deliverables.ts'
import { declaredFor } from '../support/rule-values.ts'

vi.mock('../../src/components/mascot/auto-mascot.tsx', async () => {
  const { createElement } = await import('react')
  return {
    AutoMascot: ({ state, caption, size = 'regular' }: Pick<AutoMascotProps, 'state' | 'caption' | 'size'>) =>
      createElement('div', { 'data-testid': 'auto', 'data-state': state, 'data-size': size }, caption),
  }
})

const NOW = new Date(2026, 9, 14, 15, 30)
const SHELF_CSS = 'components/play/deliverables/shelf.module.css'

const header = () => screen.getByRole('heading', { level: 1, name: SHELF_TITLE }).closest('header') as HTMLElement

beforeEach(() => {
  host.reset()
})

describe('the empty shelf (Play 1.1.1)', () => {
  it('drops the header Auto and centres one regular Auto with the empty message as his caption, then Start a chat', () => {
    answer({ data: { pages: [page([])] } })
    render(<ShelfScreen now={NOW} />)
    const autos = screen.getAllByTestId('auto')
    expect(autos).toHaveLength(1)
    const [auto] = autos
    expect(header()).not.toContainElement(auto)
    expect(auto).toHaveAttribute('data-size', 'regular')
    expect(auto).toHaveTextContent(emptyMessage(ALL_FILTER))
    const start = screen.getByRole('button', { name: START_A_CHAT })
    expect(auto.parentElement).toBe(start.parentElement)
    expect(auto.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("names the chip's type in his caption when that chip has nothing", async () => {
    answer({ data: { pages: [page([])] } })
    const user = userEvent.setup()
    render(<ShelfScreen now={NOW} />)
    await user.click(screen.getByRole('button', { name: 'Spreadsheets' }))
    expect(screen.getByTestId('auto')).toHaveTextContent('No spreadsheets yet. Ask Auto for one and it lands here.')
  })

  it('keeps the small Auto in the header while the shelf has cards', () => {
    answer({ data: { pages: [page(ROWS)] } })
    render(<ShelfScreen now={NOW} />)
    const auto = screen.getByTestId('auto')
    expect(header()).toContainElement(auto)
    expect(auto).toHaveAttribute('data-size', 'small')
  })

  it('lays the empty block out centred, as wide as a reading column at most', () => {
    const empty = declaredFor(SHELF_CSS, '.empty')
    expect([empty.get('align-self'), empty.get('align-items'), empty.get('text-align')]).toEqual(['center', 'center', 'center'])
    expect(empty.get('max-width')).toBe('var(--pl-content-max)')
  })
})
