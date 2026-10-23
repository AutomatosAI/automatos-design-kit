/**
 * PRD-260 P260-FX-13 — Auto's reply as markdown (PlayMarkdown) on Automatos
 * Play's rules for model output: a fenced block prints in Play's own <pre>, not
 * the core's dark CodeBlock card with its Copy header (M36), and raw HTML is
 * dropped, never printed as literal tags (M39). The Deliverable sheet shares
 * these components (play-deliverable.test.tsx). Roles, attributes and text only
 * (CSS modules are proxies under css: false).
 *
 * Moved from core's components/play/chat/__tests__/play-markdown.test.tsx and rewritten for the kit. The
 * markdown renderer is the host's (the SDK's MarkdownView: react-markdown with remark-gfm), which the
 * harness stands in for with the text as it is, so each case asserts Play's half of what core's rendered:
 * what PlayMarkdown hands the renderer (skipHtml, its own components, the compact density, the text) and
 * what each of its components draws (the plain <pre>, the link in a new tab, the image as its alt text). The
 * renderer's half (markdown into elements, a fenced block into <pre>, raw HTML dropped under skipHtml) is
 * core's: the ledger (test/moved-from-core/lib.json) names the core tests that hold it.
 */
import { MarkdownView } from '@automatos/theme-sdk'
import { render, screen } from '@testing-library/react'
import { isValidElement } from 'react'
import { describe, expect, it } from 'vitest'

import { PLAY_MARKDOWN_COMPONENTS, PlayMarkdown } from '../../src/components/play/chat/play-markdown.tsx'

const RAW_HTML = 'a<br>b and <script>alert(1)</script> done'

/** What PlayMarkdown hands the host's renderer: it draws one MarkdownView, so the props are read off it. */
function rendererProps(text: string): Readonly<Record<string, unknown>> {
  const element = PlayMarkdown({ text })
  const type: unknown = isValidElement(element) ? element.type : null
  if (type !== MarkdownView) throw new Error("PlayMarkdown no longer hands its text to the SDK's MarkdownView")
  return element.props as Readonly<Record<string, unknown>>
}

describe("PlayMarkdown — Auto's reply", () => {
  it("prints a fenced block in Play's own <pre>, not the core's CodeBlock card with Copy", () => {
    expect(rendererProps('Run this').components).toBe(PLAY_MARKDOWN_COMPONENTS)
    const { pre: Pre } = PLAY_MARKDOWN_COMPONENTS
    const { container } = render(
      <Pre>
        <code>print("hi")</code>
      </Pre>,
    )
    const pre = container.querySelector('pre')
    expect(pre).toHaveTextContent('print("hi")')
    expect(pre?.querySelector('code')).toHaveTextContent('print("hi")')
    expect(pre).not.toHaveAttribute('class')
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull()
  })

  it('drops raw HTML instead of printing its tags, and keeps the words around them', () => {
    const props = rendererProps(RAW_HTML)
    expect(props.skipHtml).toBe(true)
    expect(props.children).toBe(RAW_HTML)
    expect(props.density).toBe('compact')
  })

  it('still renders markdown, opens links in a new tab and shows an image as its alt text', () => {
    const { a: Link, img: Image } = PLAY_MARKDOWN_COMPONENTS
    render(<Link href="https://example.com">site</Link>)
    const link = screen.getByRole('link', { name: 'site' })
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveAttribute('target', '_blank')
    const { container } = render(<Image alt="a chart" src="https://evil.example/c.png" />)
    expect(screen.getByText('a chart')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })
})
