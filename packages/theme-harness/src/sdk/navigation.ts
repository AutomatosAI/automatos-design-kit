/**
 * PRD-261 B-02b: the fake of SDK area `navigation`. It mirrors core's frontend/lib/theme-sdk/navigation.tsx
 * (at 101a0bf33f64fb4f89af81b4293415be60b661ac): the same route constants and builders (lib/ticket-links.ts),
 * the same href rules (internal/href.ts: a path inside the app, or https out of it; anything else is a
 * TypeError), and the core nav (internal/core-menu.ts). The App Router is a spy: push and replace move the
 * fake URL (useHostPathname, useHostSearchParams) and every call is kept (host.navigations()); HostLink is an
 * <a>, and a plain click on a path inside the app is a push, as next/link's is.
 */
import type { CoreNav, HostLinkProps, HostQuestionRef, HostRouter } from '@automatos/theme-sdk'
import { createElement, forwardRef, useMemo, type MouseEvent } from 'react'
import { cell, log, refuse } from '../internal/cell.ts'
import { activeMenuId, buildCoreNav } from '../internal/core-menu.ts'
import { useCurrentEdition, useCurrentRole } from './context.ts'

type Sdk = typeof import('@automatos/theme-sdk')

/** ticket-links.ts:14, :15, :50, :53, :55, :58, :60 and deliverables/tabs.ts:15. */
export const BOARD_HREF = '/command-center?tab=board' satisfies Sdk['BOARD_HREF']
export const QUESTIONS_HREF = '/command-center?tab=questions' satisfies Sdk['QUESTIONS_HREF']
export const CHAT_HREF = '/chat' satisfies Sdk['CHAT_HREF']
export const DELIVERABLES_HREF = '/deliverables' satisfies Sdk['DELIVERABLES_HREF']
export const DELIVERABLE_EXPLORER_HREF = '/deliverables/explorer' satisfies Sdk['DELIVERABLE_EXPLORER_HREF']
export const DELIVERABLE_PARAM = 'deliverable' satisfies Sdk['DELIVERABLE_PARAM']
export const LOOKS_HREF = '/looks' satisfies Sdk['LOOKS_HREF']
export const LOOK_STYLE_HREF = '/looks/style' satisfies Sdk['LOOK_STYLE_HREF']

/** ticket-links.ts:20: the board, opened at one ticket and, when given, at one of its questions. */
export const ticketHref = ((taskId: string | number, questionId?: string | number | null): string => {
  const params = new URLSearchParams({ tab: 'board', task_id: String(taskId) })
  if (questionId !== null && questionId !== undefined) params.set('question', String(questionId))
  return `/command-center?${params.toString()}`
}) satisfies Sdk['ticketHref']

/** ticket-links.ts:32-42: a question opens inside its ticket; one about anything else opens the Questions tab. */
export const questionHref = ((question: HostQuestionRef): string => {
  const owned = question.owner?.ticket?.id
  const ticket = question.subject_type === 'board_task' && question.subject_id
    ? question.subject_id
    : (owned !== null && owned !== undefined ? String(owned) : null)
  return ticket ? ticketHref(ticket, question.id) : QUESTIONS_HREF
}) satisfies Sdk['questionHref']

/** ticket-links.ts:45. */
export const missionHref = ((missionId: string | number): string => `/missions/${encodeURIComponent(String(missionId))}`) satisfies Sdk['missionHref']

/** ticket-links.ts:66: a query param on /chat. */
export const chatHref = ((chatId: string): string => `${CHAT_HREF}?chatId=${encodeURIComponent(chatId)}`) satisfies Sdk['chatHref']

// ---- href rules: internal/href.ts:11-49 ----

const INTERNAL_HREF = /^\/(?![/\\])/
const EXTERNAL_HREF = /^https:\/\/[^/\\\s]/i
/** A C0 control, DEL or any whitespace anywhere refuses an href (browsers strip some before parsing). */
const UNSAFE_CHAR = /[\u0000-\u001f\u007f\s]/
const BACKSLASH = '\\'
const EXTERNAL_TARGET = '_blank'
const EXTERNAL_REL = 'noopener noreferrer'
const MAIN_BUTTON = 0
/** Any origin: an href inside the app is read against it for its path and query only. */
const URL_BASE = 'http://localhost'

const isInternalHref = (href: unknown): href is string =>
  typeof href === 'string' && INTERNAL_HREF.test(href) && !UNSAFE_CHAR.test(href) && !href.includes(BACKSLASH)
const isExternalHref = (href: unknown): href is string => typeof href === 'string' && EXTERNAL_HREF.test(href) && !UNSAFE_CHAR.test(href)

function assertInternalHref(href: unknown): asserts href is string {
  if (!isInternalHref(href)) refuse(`"${String(href)}" is not a path inside the app.`)
}

// ---- the fake URL and router ----

/** One router call a theme made: push, replace and prefetch name their href. */
export interface Navigation {
  readonly method: keyof HostRouter
  readonly href?: string
}

const pathname = cell<string>('/')
const search = cell<string>('')
const coreNav = cell<CoreNav | null>(null)
const navigations = log<Navigation>()

/** Moves the fake URL to `href` (a path inside the app): its path and its query string. */
function moveTo(href: string): void {
  const url = new URL(href, URL_BASE)
  pathname.set(url.pathname)
  search.set(url.search.replace(/^\?/, ''))
}

function navigate(method: 'push' | 'replace', href: string): void {
  assertInternalHref(href)
  navigations.add(Object.freeze({ method, href }))
  moveTo(href)
}

const ROUTER: HostRouter = Object.freeze({
  push: (href: string) => navigate('push', href),
  replace: (href: string) => navigate('replace', href),
  back: () => navigations.add(Object.freeze({ method: 'back' as const })),
  refresh: () => navigations.add(Object.freeze({ method: 'refresh' as const })),
  prefetch: (href: string) => {
    assertInternalHref(href)
    navigations.add(Object.freeze({ method: 'prefetch' as const, href }))
  },
})

/** navigation.tsx:59: the App Router, taking only paths inside the app. */
export const useHostRouter = ((): HostRouter => ROUTER) satisfies Sdk['useHostRouter']

/** navigation.tsx:80: the current path, without the query string. */
export const useHostPathname = ((): string => pathname.use()) satisfies Sdk['useHostPathname']

/** navigation.tsx:85: a copy of the query string, a new one when the URL's query changes. */
export const useHostSearchParams = (() => {
  const query = search.use()
  return useMemo(() => new URLSearchParams(query), [query])
}) satisfies Sdk['useHostSearchParams']

/** A plain left click with nothing else asked of it: next/link's client-side navigation. */
function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return !event.defaultPrevented && event.button === MAIN_BUTTON && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

/** navigation.tsx:91: an <a> for a path inside the app (a push on a plain click), a new tab for https, else a TypeError. */
export const HostLink = forwardRef<HTMLAnchorElement, HostLinkProps>(function HostLink({ href, children, onClick, ...rest }, ref) {
  if (isExternalHref(href)) {
    return createElement('a', { ...rest, onClick, ref, href, target: EXTERNAL_TARGET, rel: EXTERNAL_REL }, children)
  }
  if (!isInternalHref(href)) throw new TypeError(`Automatos theme SDK: HostLink cannot link to "${String(href)}".`)
  const follow = (event: MouseEvent<HTMLAnchorElement>): void => {
    onClick?.(event)
    if (!isPlainClick(event)) return
    event.preventDefault()
    navigate('push', href)
  }
  return createElement('a', { ...rest, onClick: follow, ref, href }, children)
}) satisfies Sdk['HostLink']

/** navigation.tsx:102: the core nav for this edition and role, unless a test set one. */
export const useCoreNav = ((): CoreNav => {
  const set = coreNav.use()
  const edition = useCurrentEdition()
  const { isAdmin } = useCurrentRole()
  return useMemo(() => set ?? buildCoreNav(edition, isAdmin), [set, edition, isAdmin])
}) satisfies Sdk['useCoreNav']

/** navigation.tsx:109 over lib/studio-menu.ts:96. */
export const resolveActiveNavId = ((path: string): string | null => activeMenuId(path)) satisfies Sdk['resolveActiveNavId']

/** The controls of this area, gathered by host.ts. */
export const navigationControls = Object.freeze({
  /** The current path from now on (no query string). */
  setPathname(next: string): void {
    pathname.set(next)
  },
  /** The URL's query string from now on, without its '?' ('' for none). */
  setSearchParams(query: string): void {
    search.set(query)
  },
  /** The core nav from now on; null builds it from the edition and the role again. */
  setCoreNav(next: CoreNav | null): void {
    coreNav.set(next)
  },
  /** Every router call and followed link since the last reset, oldest first. */
  navigations(): readonly Navigation[] {
    return navigations.all()
  },
})

export function resetNavigation(): void {
  pathname.set('/')
  search.set('')
  coreNav.set(null)
  navigations.clear()
}
