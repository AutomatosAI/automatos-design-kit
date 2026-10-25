/**
 * PRD-261 B-02c: the host cards' stand-ins (src/sdk/cards/*.tsx, re-exported by src/sdk/cards.ts) take the props of
 * the vendored packages/theme-sdk/areas/cards.d.ts (the fixtures in fixtures/cards/*.json are typed as those props
 * here, so tsc holds them to the declarations), each root carries data-protected-surface, the approvals refuse a
 * payload whose id is not an id as core's do, and every click is kept (cardActions). The edition and the trial the
 * chrome reads come from a mock of src/internal/scripted/host-inputs.ts.
 */
import type {
  HostTrial,
  MissionApprovalData,
  MissionSuggestionCardProps,
  TaskCardData,
  ToolApprovalData,
  WithdrawOffer,
} from '@automatos/theme-sdk'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { Component, type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import missionFixture from '../fixtures/cards/mission-approval.json'
import suggestionFixture from '../fixtures/cards/mission-suggestion.json'
import taskFixture from '../fixtures/cards/task-card.json'
import toolFixture from '../fixtures/cards/tool-approval.json'
import withdrawFixture from '../fixtures/cards/withdraw-offer.json'
import { PROTECTED_SURFACE_ATTR, PROTECTED_SURFACE_INNER_ATTR } from '../src/internal/scripted/cards-log.ts'
import {
  AiLabelFence, cardsControls, CorePage, FilePreview, FirstRunNudge, HeaderUtilities, MadeBy, MarkdownView, MissionApproval,
  MissionCreatedCard, MissionSuggestionCard, resetCards, TaskCard, ToolApproval, TrialExhaustedBanner, WithdrawOfferCard,
} from '../src/sdk/cards.ts'
import { APPROVE_LABEL, APPROVED_LINE, DENIED_LINE, DENY_LABEL, REJECT_LABEL } from '../src/sdk/cards/approvals.tsx'
import { CREATE_MISSION_LABEL, DISMISS_SUGGESTION_LABEL, KEEP_LABEL, KEPT_LINE, WITHDRAW_LABEL, WITHDRAWN_LINE } from '../src/sdk/cards/chat-cards.tsx'
import {
  CREDITS_PAUSED_LINE, DISMISS_LABEL, HEADER_UTILITIES, HEADER_UTILITIES_LABEL, NUDGE_LINE, NUDGE_LINK_LABEL, UNREAD_SAMPLE,
} from '../src/sdk/cards/chrome.tsx'
import { NUDGE_PILL } from '../src/sdk/cards/chrome-styles.ts'
import { MADE_BY_FALLBACK } from '../src/sdk/cards/content.tsx'
import { chatControls, resetChat } from '../src/sdk/chat.ts'

const inputs = vi.hoisted(() => ({ edition: 'local' as 'local' | 'saas', trial: null as HostTrial | null }))

vi.mock('../src/internal/scripted/host-inputs.ts', () => ({
  CHAT_HREF: '/chat',
  useEdition: () => inputs.edition,
  useTrial: () => inputs.trial,
  useHealth: () => ({ connection: 'connected', checking: false, check: () => undefined }),
  useWorkspace: () => ({ workspace: null, isLoading: false }),
  useHostSearchParams: () => new URLSearchParams(),
  useHostRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}))

const { cardActions } = cardsControls
const { setAiLabelShown } = chatControls
const TOOL: ToolApprovalData = toolFixture as ToolApprovalData
const MISSION: MissionApprovalData = missionFixture as MissionApprovalData
const TASK: TaskCardData = taskFixture
const WITHDRAW: WithdrawOffer = withdrawFixture
const SUGGESTION: MissionSuggestionCardProps = suggestionFixture

/** Every stand-in, drawn with fixture props, by the name its root carries. */
const EVERY_CARD: Array<[string, ReactElement]> = [
  ['tool-approval', <ToolApproval data={TOOL} />],
  ['mission-approval', <MissionApproval data={MISSION} />],
  ['task-card', <TaskCard card={TASK} />],
  ['withdraw-offer', <WithdrawOfferCard offer={WITHDRAW} />],
  ['mission-suggestion', <MissionSuggestionCard {...SUGGESTION} />],
  ['mission-created', <MissionCreatedCard missionId="harness-mission-1" />],
  ['file-preview', <FilePreview content="a,b" filename="table.csv" />],
  ['markdown-view', <MarkdownView>Words</MarkdownView>],
  ['made-by', <MadeBy agentName="Scout" />],
  ['trial-exhausted-banner', <TrialExhaustedBanner errorCode="credits_exhausted" />],
  ['first-run-nudge', <FirstRunNudge />],
  ['header-utilities', <HeaderUtilities />],
  ['ai-label-fence', <AiLabelFence><button type="button">Send</button></AiLabelFence>],
  ['core-page', <CorePage>Theme page</CorePage>],
]

/** Shows the error a child threw while rendering, as an alert. */
class Caught extends Component<{ readonly children: ReactNode }, { readonly error: Error | null }> {
  override state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  override render() {
    return this.state.error === null ? this.props.children : <p role="alert">{this.state.error.message}</p>
  }
}

const surface = (name: string): Element | null => document.querySelector(`[${PROTECTED_SURFACE_ATTR}="${name}"]`)

beforeEach(() => {
  vi.restoreAllMocks()
  resetCards()
  resetChat()
  inputs.edition = 'local'
  inputs.trial = null
})

describe('every card', () => {
  it.each(EVERY_CARD)('%s: its root carries data-protected-surface', (name, card) => {
    const { container } = render(card)
    expect(container.firstElementChild).toHaveAttribute(PROTECTED_SURFACE_ATTR, name)
  })
})

describe('the approvals', () => {
  it('ToolApproval: the title, the badge and the words; Approve & run tells onDecided, then shows the outcome', () => {
    const onDecided = vi.fn()
    render(<ToolApproval data={TOOL} conversationId="harness-chat" onDecided={onDecided} />)
    const card = screen.getByRole('region', { name: 'Action approval needed' })
    expect(card).toHaveTextContent('platform_delete_document')
    expect(card).toHaveTextContent('This action (destructive) requires confirmation.')
    expect(card.querySelector(`[${PROTECTED_SURFACE_INNER_ATTR}]`)).not.toBeNull()
    expect(card).toHaveAttribute('data-conversation-id', 'harness-chat')
    fireEvent.click(within(card).getByRole('button', { name: APPROVE_LABEL }))
    expect(onDecided).toHaveBeenCalledWith('approved')
    expect(within(card).getByRole('status')).toHaveTextContent(APPROVED_LINE)
    expect(within(card).queryByRole('button', { name: DENY_LABEL })).toBeNull()
    expect(cardActions()).toEqual([{ card: 'tool-approval', id: '26101', action: 'approved' }])
  })

  it('ToolApproval: Deny says the action will not run; the badge is the source when one is given', () => {
    render(<ToolApproval data={TOOL} source="Auto" title="Check this" />)
    const card = screen.getByRole('region', { name: 'Check this' })
    expect(card).toHaveTextContent('Auto')
    fireEvent.click(within(card).getByRole('button', { name: DENY_LABEL }))
    expect(within(card).getByRole('status')).toHaveTextContent(DENIED_LINE)
  })

  it('MissionApproval: the goal and the tasks; a decision closes the card', () => {
    const onClose = vi.fn()
    render(<MissionApproval data={MISSION} onClose={onClose} />)
    const card = screen.getByRole('region', { name: 'Mission plan — approval needed' })
    expect(within(card).getAllByRole('listitem').map((task) => task.textContent)).toEqual(['Draft the weekly report', 'Send it to the team'])
    fireEvent.click(within(card).getByRole('button', { name: REJECT_LABEL }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(cardActions()).toEqual([{ card: 'mission-approval', id: 'harness-mission-1', action: 'rejected' }])
  })

  it('refuses a payload whose id is not an id, as core does', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<Caught><ToolApproval data={{ ...TOOL, grant_id: 1.5 }} /></Caught>)
    render(<Caught><MissionApproval data={{ ...MISSION, mission_id: '../x' }} /></Caught>)
    expect(screen.getAllByRole('alert').map((alert) => alert.textContent)).toEqual([
      'Automatos theme SDK: ToolApproval needs a whole-number grant_id.',
      'Automatos theme SDK: MissionApproval needs a mission_id of letters, digits, - and _.',
    ])
    expect(cardActions()).toEqual([])
  })
})

describe('the chat cards', () => {
  it('WithdrawOfferCard: Withdraw or Keep it for each request, each choice kept', () => {
    render(<WithdrawOfferCard offer={WITHDRAW} />)
    const card = screen.getByRole('group', { name: 'Withdraw request' })
    expect(card).toHaveTextContent('A request is still waiting on your yes.')
    const [first, second] = within(card).getAllByRole('listitem')
    fireEvent.click(within(first as HTMLElement).getByRole('button', { name: WITHDRAW_LABEL }))
    fireEvent.click(within(second as HTMLElement).getByRole('button', { name: KEEP_LABEL }))
    expect(within(card).getAllByRole('listitem').map((row) => row.textContent)).toEqual([WITHDRAWN_LINE, KEPT_LINE])
    expect(cardActions()).toEqual([
      { card: 'withdraw-offer', id: '26102', action: 'withdrawn' },
      { card: 'withdraw-offer', id: '26103', action: 'kept' },
    ])
  })

  it('MissionSuggestionCard: Create Mission is kept; the suggestion can be dismissed', () => {
    render(<MissionSuggestionCard {...SUGGESTION} />)
    fireEvent.click(screen.getByRole('button', { name: CREATE_MISSION_LABEL }))
    expect(cardActions()).toEqual([{ card: 'mission-suggestion', id: 'harness-chat', action: 'created' }])
    fireEvent.click(screen.getByRole('button', { name: DISMISS_SUGGESTION_LABEL }))
    expect(surface('mission-suggestion')).toBeNull()
  })

  it('TaskCard and MissionCreatedCard say what they hold', () => {
    render(<><TaskCard card={TASK} /><MissionCreatedCard missionId="harness-mission-1" /></>)
    expect(screen.getByRole('article', { name: 'Task #0422' })).toHaveTextContent('Compare laptops')
    expect(screen.getByRole('status')).toHaveAttribute('data-mission-id', 'harness-mission-1')
  })
})

describe('content and chrome', () => {
  it('MadeBy names the agent, else where it came from, else no one known', () => {
    render(<><MadeBy agentName="Scout" sourceType="upload" /><MadeBy sourceType="social_post" /><MadeBy sourceType="toString" /></>)
    expect(Array.from(document.querySelectorAll(`[${PROTECTED_SURFACE_ATTR}="made-by"]`), (node) => node.textContent)).toEqual([
      'Scout',
      'Socials',
      MADE_BY_FALLBACK,
    ])
  })

  it('FilePreview names the preview from the file name; MarkdownView shows its text as it is, never as HTML', () => {
    render(<><FilePreview content="a,b" filename="table.csv" /><FilePreview url="/api/x" previewType="pdf" /><MarkdownView>{'<b>bold</b>'}</MarkdownView></>)
    const previews = document.querySelectorAll(`[${PROTECTED_SURFACE_ATTR}="file-preview"]`)
    expect(Array.from(previews, (node) => node.getAttribute('data-preview-type'))).toEqual(['csv', 'pdf'])
    expect(surface('markdown-view')).toHaveTextContent('<b>bold</b>')
    expect(surface('markdown-view')?.querySelector('b')).toBeNull()
  })

  it('TrialExhaustedBanner draws nothing while work runs; shows once credits are used up', () => {
    const { rerender } = render(<TrialExhaustedBanner errorCode={null} />)
    expect(surface('trial-exhausted-banner')).toBeNull()
    rerender(<TrialExhaustedBanner errorCode="credits_exhausted" />)
    expect(screen.getByRole('alert')).toHaveTextContent(CREDITS_PAUSED_LINE)
    inputs.trial = { state: 'exhausted', grantedUsd: 5, spentUsd: 5 }
    rerender(<TrialExhaustedBanner />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('FirstRunNudge: on the local edition until dismissed, never in SaaS', () => {
    const { unmount } = render(<FirstRunNudge />)
    expect(screen.getByText(NUDGE_LINE)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: DISMISS_LABEL }))
    expect(surface('first-run-nudge')).toBeNull()
    unmount()
    inputs.edition = 'saas'
    render(<FirstRunNudge />)
    expect(surface('first-run-nudge')).toBeNull()
  })

  it("FirstRunNudge: core's zero-height anchor, its pill over the top of the chat, core's words and a kept click on Settings", () => {
    render(<FirstRunNudge />)
    const anchor = surface('first-run-nudge')
    expect(anchor).toHaveStyle({ position: 'relative', height: '0px', zIndex: '30' })
    const pill = screen.getByRole('status')
    expect(anchor).toContainElement(pill)
    expect(pill).toHaveStyle({ position: 'absolute', left: '50%', top: '12px', whiteSpace: 'nowrap' })
    expect(NUDGE_PILL).toMatchObject({ transform: 'translateX(-50%)', borderRadius: '9999px', padding: '8px 16px', gap: '12px' })
    expect(pill).toHaveTextContent(`${NUDGE_LINE}${NUDGE_LINK_LABEL}`)
    fireEvent.click(within(pill).getByRole('link', { name: NUDGE_LINK_LABEL }))
    expect(cardActions()).toEqual([{ card: 'first-run-nudge', id: '/settings', action: 'opened' }])
  })

  it("HeaderUtilities: core's cluster, icon-sized Help, bell with its badge and theme menu, then the account's avatar", () => {
    render(<HeaderUtilities />)
    const group = screen.getByRole('group', { name: HEADER_UTILITIES_LABEL })
    expect(group).toHaveStyle({ display: 'inline-flex' })
    const button = (name: string): HTMLElement => within(group).getByRole('button', { name })
    const buttons = within(group).getAllByRole('button')
    expect(buttons).toHaveLength(HEADER_UTILITIES.length)
    HEADER_UTILITIES.forEach((name, index) => expect(buttons[index]).toBe(button(name)))
    expect(button('Help')).toHaveStyle({ width: '30px', height: '30px' })
    expect([button('Notifications'), button('Theme')].map((icon) => [icon.style.width, icon.style.height])).toEqual([['40px', '40px'], ['40px', '40px']])
    const badge = button('Notifications').querySelector('[data-harness-part="badge"]')
    expect(badge).toHaveTextContent(String(UNREAD_SAMPLE))
    expect(badge).toHaveStyle({ position: 'absolute', top: '-4px', right: '-4px', height: '18px' })
    expect(button('Account').querySelector('[data-harness-part="avatar"]')).toHaveStyle({ width: '36px', height: '36px' })
  })

  it('HeaderUtilities keeps each click; AiLabelFence leaves the composer on while the label shows; CorePage shows its children', () => {
    render(<><HeaderUtilities /><AiLabelFence><button type="button">Send</button></AiLabelFence><CorePage>Theme page</CorePage></>)
    fireEvent.click(screen.getByRole('button', { name: 'Help' }))
    expect(cardActions()).toEqual([{ card: 'header-utilities', id: 'Help', action: 'opened' }])
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    expect(surface('core-page')).toHaveTextContent('Theme page')
  })

  it('AiLabelFence: every control inside is disabled while the host\'s AI label is off screen', () => {
    setAiLabelShown(false)
    render(<AiLabelFence label="widget"><button type="button">Send</button></AiLabelFence>)
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(surface('ai-label-fence')).toHaveAttribute('data-label', 'widget')
  })
})
