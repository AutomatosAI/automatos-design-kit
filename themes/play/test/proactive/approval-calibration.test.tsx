// Play 1.3.0 (PRD-268 §6.11.4, §6.11.5, §6.12.4, US-K01) — Auto's two other proactive moments in Play's chat, on the
// harness's fakes. An approval (a recorded tool_approval part carrying SDK 1.3.0's approval_view) stays the host's
// protected card inline in Auto's reply, with no sheet over it, Auto listening while it waits, and the pinned
// suggestion still in its place. Calibration (host.setCalibration: core's server offers none yet) is one of Auto's
// bubbles on the empty chat, the host's CalibrationCard inside it, with Auto saying hello; its answers are the fake
// area's (host.pageRuns()). Auto himself is a stand-in that shows his state and caption.
import { writeThemeState } from '@automatos/theme-sdk'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AutoMascotProps } from '../../src/components/mascot/auto-mascot.tsx'
import { AWAITING_ANSWER } from '../../src/components/play/chat/caption.ts'
import { HELLO_TITLE } from '../../src/components/play/chat/first-open.tsx'
import { PLACEHOLDER } from '../../src/components/play/chat/message-box.tsx'
import { PlayChat } from '../../src/components/play/chat/play-chat.tsx'
import { CALIBRATION_LABEL } from '../../src/components/play/proactive/play-calibration.tsx'
import { BRIEF_LABEL } from '../../src/components/play/proactive/play-brief.tsx'
import { HELLO_KEY, HELLO_STATE } from '../../src/lib/mascot/session.ts'
import { host } from '@automatos/theme-harness/host'
import { BRIEF, CALIBRATION, NEWER, SUGGESTIONS } from '../support/proactive.ts'

vi.mock('../../src/components/mascot/auto-mascot.tsx', async () => {
  const { createElement } = await import('react')
  return {
    AutoMascot: ({ state, caption, detail }: Pick<AutoMascotProps, 'state' | 'caption' | 'detail'>) =>
      createElement('div', { 'data-testid': 'auto', 'data-state': state }, caption, ' ', detail),
  }
})

type Turn = Parameters<typeof host.setChatScript>[0][number]

const UPDATED = '2026-10-14T09:00:00+00:00'
const GRANT_ID = 26102
/** A send that waits for the owner, as core's result formatter raises it, with SDK 1.3.0's approval view. */
const TOOL_APPROVAL = {
  grant_id: GRANT_ID,
  action: 'platform_send_message',
  message: 'This action (sends) requires confirmation.',
  permission_level: 'sends',
  params: { channel: 'whatsapp' },
  risk_tier: 'human_in_the_loop',
  approval_view: {
    grant_id: String(GRANT_ID),
    asked_by: { kind: 'auto', name: 'Auto' },
    action: { verb: 'send', summary: "Send the bake sale reminder to the parents' group" },
    target: { label: "Parents' group", detail: 'WhatsApp' },
    preview: { kind: 'text', body: 'The bake sale is on Friday at 3 pm in the school hall.' },
    rule: { id: 'posture.balanced.sends', sentence: 'Ask before anything that sends to other people' },
    answers: ['refuse', 'allow_once'],
  },
}
const APPROVAL_TURN: Turn = {
  frames: [{ text: 'I need your answer before I send this.' }, { data: { type: 'tool-data', data: { tool_approval: TOOL_APPROVAL } } }],
}

const auto = () => screen.getByTestId('auto')

beforeEach(() => {
  host.reset()
  writeThemeState(HELLO_KEY, true, HELLO_STATE) // hello already played this session
})

describe('an approval, as today: inline in Auto\'s reply', () => {
  it('places the host card in the reply that raised it, draws no sheet over it, and Auto listens while it waits', async () => {
    host.setPageQuery('useSuggestions', { data: SUGGESTIONS })
    host.setConversations([{ id: 'c1', title: 'Bake sale', updatedAt: UPDATED, preview: null, messages: [{ role: 'user', text: 'Hello' }] }])
    host.setSearchParams('chatId=c1')
    host.setChatScript([APPROVAL_TURN])
    const view = render(<PlayChat />)
    await screen.findByRole('list', { name: 'Conversation' })
    const box = screen.getByRole('textbox', { name: PLACEHOLDER })
    fireEvent.change(box, { target: { value: "Remind the parents' group" } })
    fireEvent.keyDown(box, { key: 'Enter' })

    await waitFor(() => expect(view.container.querySelector('[data-protected-surface="tool-approval"]')).not.toBeNull())
    const card = view.container.querySelector('[data-protected-surface="tool-approval"]') as HTMLElement
    expect(card.closest('article')).toHaveAccessibleName('Auto said')
    expect(within(card).getByText('Ask before anything that sends to other people')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'listening'))
    expect(auto()).toHaveTextContent(AWAITING_ANSWER)
    expect(screen.getByRole('group', { name: `Auto suggests: ${NEWER.title}` })).toBeInTheDocument()
  })
})

describe('calibration, on day one', () => {
  it("draws Auto's bubble with the host's card on the empty chat, and Auto says hello though the session's hello played", () => {
    host.setCalibration(CALIBRATION)
    render(<PlayChat />)
    const bubble = screen.getByRole('article', { name: CALIBRATION_LABEL })
    expect(within(bubble).getByRole('heading', { name: 'Auto' })).toBeInTheDocument()
    expect(within(bubble).getByText(CALIBRATION.lines[0].text).closest('[data-ai-generated]')).not.toBeNull()
    expect(screen.queryByRole('heading', { name: HELLO_TITLE })).toBeNull()
    expect(auto()).toHaveAttribute('data-state', 'hello')
  })

  it('comes before the day\'s brief, both in the first open\'s place', () => {
    host.setCalibration(CALIBRATION)
    host.setPageQuery('useBrief', { data: BRIEF })
    render(<PlayChat />)
    const bubble = screen.getByRole('article', { name: CALIBRATION_LABEL })
    const brief = screen.getByRole('region', { name: BRIEF_LABEL })
    expect(Boolean(bubble.compareDocumentPosition(brief) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
  })

  it("answers Sounds right through the proactive area, and Something's off hands over the message box", async () => {
    host.setCalibration(CALIBRATION)
    render(<PlayChat />)
    const bubble = screen.getByRole('article', { name: CALIBRATION_LABEL })
    fireEvent.click(within(bubble).getByRole('button', { name: "Something's off" }))
    expect(screen.getByRole('textbox', { name: PLACEHOLDER })).toHaveFocus()
    fireEvent.click(within(bubble).getByRole('button', { name: 'Sounds right' }))
    await waitFor(() => expect(host.pageRuns()).toContainEqual({
      hook: 'useAnswerCalibration', variables: { calibration_id: CALIBRATION.id, answer: 'accept' },
    }))
  })

  it('is not drawn while the server offers none, nor in a conversation', async () => {
    const first = render(<PlayChat />)
    expect(screen.queryByRole('article', { name: CALIBRATION_LABEL })).toBeNull()
    expect(screen.getByRole('heading', { name: HELLO_TITLE })).toBeInTheDocument()
    first.unmount()

    host.setCalibration(CALIBRATION)
    host.setConversations([{ id: 'c1', title: 'Bake sale', updatedAt: UPDATED, preview: null, messages: [{ role: 'user', text: 'Hello' }] }])
    host.setSearchParams('chatId=c1')
    render(<PlayChat />)
    await screen.findByRole('list', { name: 'Conversation' })
    expect(screen.queryByRole('article', { name: CALIBRATION_LABEL })).toBeNull()
    expect(auto()).not.toHaveAttribute('data-state', 'hello')
  })
})
