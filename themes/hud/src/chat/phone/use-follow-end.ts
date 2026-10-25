import { type RefObject, useEffect, useRef } from 'react'
import type { HostChatMessage } from '@automatos/theme-sdk'

import { nearBottom } from '../transcript'

/**
 * The phone screen scrolls as one when the window is too short for it (phone-screen.tsx), its dock pinned to its foot,
 * so it follows the conversation as the desktop's transcript does (transcript.tsx): to its end as Auto writes, unless
 * you scrolled up to read; a new message follows again. Its end is the dock's own place, so the newest line stands
 * just over the dock, never under it.
 */
export function useFollowEnd(messages: readonly HostChatMessage[]): RefObject<HTMLDivElement | null> {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const count = messages.length
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return undefined
    const onScroll = () => {
      following.current = nearBottom(scroller)
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    following.current = true
  }, [count])
  useEffect(() => {
    const scroller = scrollerRef.current
    if (following.current && scroller) scroller.scrollTop = scroller.scrollHeight
  }, [messages])
  return scrollerRef
}
