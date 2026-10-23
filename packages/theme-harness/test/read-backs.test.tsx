// PRD-261 W-K6: three read-backs Play's moved tests need, each kept as core's own spy saw it: every load of a
// conversation list with the most it asked for (core's getChatHistory), the words a theme gave useFileDownload
// for a failed download, kept with each download, and the props each MarkdownView drew with (the stand-in shows
// its text as it is, so the element overrides and skipHtml are read back, not rendered). host.reset() forgets them.
import { MarkdownView, useConversationList, useFileDownload, useRecentChats } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '../src/host.ts'

const CONVERSATIONS = [{ id: 'harness-chat-1', title: 'Bake sale', updatedAt: '2026-10-14T09:00:00Z', preview: null }]
/** hooks/use-conversation-list.ts:21 and hooks/use-recent-chats.ts:20: the host's own limits. */
const HOST_LIMIT = 50
const RECENT_LIMIT = 8
/** A limit of the theme's own. */
const OWN_LIMIT = 3
const OWN_WORDS = "The theme's words: the file didn't download."

beforeEach(() => {
  host.reset()
})

describe('conversationsAsked', () => {
  function Lists() {
    const list = useConversationList()
    useConversationList(OWN_LIMIT)
    useRecentChats()
    if (list.status === 'failed') return <button type="button" onClick={list.retry}>Retry</button>
    return <p>{list.status}</p>
  }

  it('keeps each load of a list with its limit: on mount, on Retry and when the backend answers again', async () => {
    host.setConversations(CONVERSATIONS)
    host.setHealth('down')
    render(<Lists />)
    expect(host.conversationsAsked()).toEqual([{ limit: HOST_LIMIT }, { limit: OWN_LIMIT }, { limit: RECENT_LIMIT }])
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(host.conversationsAsked()).toHaveLength(4)
    expect(host.conversationsAsked()[3]).toEqual({ limit: HOST_LIMIT })
    act(() => host.setHealth('connected'))
    expect(await screen.findByText('loaded')).toBeInTheDocument()
    expect(host.conversationsAsked()).toHaveLength(7)
  })

  it('forgets them on reset', async () => {
    render(<Lists />)
    expect(await screen.findByText('loaded')).toBeInTheDocument()
    expect(host.conversationsAsked()).toHaveLength(3)
    act(() => host.reset())
    expect(host.conversationsAsked()).toEqual([])
  })
})

describe("downloadsAsked: the theme's words for a failure", () => {
  it('keeps the words useFileDownload was given with each download, and none when the theme gave none', () => {
    function Downloads() {
      const own = useFileDownload(OWN_WORDS)
      const plain = useFileDownload()
      return (
        <>
          <button type="button" onClick={() => void own.download('/api/a', 'a.md')}>Own words</button>
          <button type="button" onClick={() => void plain.download('/api/b', 'b.md')}>Host words</button>
        </>
      )
    }
    render(<Downloads />)
    fireEvent.click(screen.getByRole('button', { name: 'Own words' }))
    fireEvent.click(screen.getByRole('button', { name: 'Host words' }))
    expect(host.downloadsAsked()).toEqual([
      { url: '/api/a', filename: 'a.md', failedMessage: OWN_WORDS },
      { url: '/api/b', filename: 'b.md' },
    ])
    expect(host.downloadsAsked()[1]).not.toHaveProperty('failedMessage')
  })
})

describe('markdownViews', () => {
  it('keeps the props each MarkdownView drew with, shows its text as it is, and forgets them on reset', () => {
    const components = Object.freeze({ pre: () => null })
    render(<MarkdownView skipHtml density="compact" components={components}>{'# Title <b>x</b>'}</MarkdownView>)
    const [drawn] = host.markdownViews()
    expect(drawn).toMatchObject({ skipHtml: true, density: 'compact', children: '# Title <b>x</b>' })
    expect(drawn?.components).toBe(components)
    expect(screen.getByText('# Title <b>x</b>')).toBeInTheDocument()
    host.reset()
    expect(host.markdownViews()).toEqual([])
  })
})
