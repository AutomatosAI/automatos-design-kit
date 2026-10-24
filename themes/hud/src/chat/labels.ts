// After themes/play/src/components/play/chat/labels.ts (Play 1.1.1): a tool call in words, as Play says it, with
// HUD's status glyphs (the Command design's README, "Status": a glyph and a word, never colour alone), so a running
// call is ▸ instead of Play's spinner.
import type { HostToolCall } from '@automatos/theme-sdk'

import { toolActivity, type ToolActivity } from '@automatos/mascot/tools'

/**
 * What a call is about, from its input (the search query, the page, the title), and its line in Auto's reply:
 * "▸ Searching the web: '…'" while it runs, "✓ Searched the web · 3 results · 2.1 s" when it is done. The state
 * chip under the core shows the same detail while the call runs. Tool names stay in @automatos/mascot's tools: a
 * label comes from the tool's activity, or from its name made readable, so a tool the backend adds later still
 * reads sensibly. Pure.
 */

const DETAIL_KEYS = ['query', 'q', 'url', 'title', 'name', 'filename', 'path'] as const
const DETAIL_CHARS = 80
const SEP = ' · '
const PLATFORM_PREFIX = /^platform_/
const A_TOOL = 'a tool'
const MS_PER_SECOND = 1000

/** A done line's time reads '2.1 s', as Play's does. */
export const SECONDS_DECIMALS = 1

/** The line's state: the SDK's tool call (running, completed, error) read with its waiting and skipped flags. */
export type ToolStatus = 'running' | 'done' | 'failed' | 'waiting' | 'skipped' | 'stopped'

/** running and waiting are the accent, done the line's own colour, failed the error, skipped and stopped muted. */
export type LineTone = 'running' | 'done' | 'failed' | 'waiting' | 'muted'

export interface ToolLineLabel {
  /** The status glyph before the words. */
  readonly mark: string
  readonly text: string
  readonly tone: LineTone
}

export const MARK_RUNNING = '▸'
export const MARK_DONE = '✓'
export const MARK_FAILED = '✕'
export const MARK_WAITING = '…'
export const MARK_MUTED = '–'
export const WAITING_FOR_YOU = 'Waiting for you'

interface Phrases {
  readonly running: string
  readonly done: string
  readonly failed: string
}

function recordOf(value: unknown): Readonly<Record<string, unknown>> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

/** One line, at most `limit` characters, an ellipsis when cut. */
export function clip(text: string, limit: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length <= limit ? flat : `${flat.slice(0, limit - 1).trimEnd()}…`
}

/** The first non-blank text field of the call's input, by DETAIL_KEYS order; null when it has none. */
export function toolDetail(input: unknown): string | null {
  const fields = recordOf(input)
  if (fields === null) return null
  for (const key of DETAIL_KEYS) {
    const value = fields[key]
    if (typeof value === 'string' && value.trim()) return clip(value, DETAIL_CHARS)
  }
  return null
}

/** A done call's time in seconds with SECONDS_DECIMALS places: '2.1 s' from 2140 ms; '' with no usable time. */
export function toolSeconds(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return ''
  return `${(ms / MS_PER_SECOND).toFixed(SECONDS_DECIMALS)} s`
}

function readable(toolName: string): string {
  return toolName.replace(PLATFORM_PREFIX, '').replace(/_+/g, ' ').trim() || A_TOOL
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function phrases(activity: ToolActivity, toolName: string): Phrases {
  if (activity === 'searching') {
    return { running: 'Searching the web', done: 'Searched the web', failed: "The web search didn't work" }
  }
  if (activity === 'reading') {
    return { running: 'Looking through your files', done: 'Looked through your files', failed: "Couldn't look through your files" }
  }
  const name = readable(toolName)
  return { running: `Using ${name}`, done: `Used ${name}`, failed: `${capitalise(name)} didn't work` }
}

/**
 * The call as a line state. A call still running on a reply no longer being written was stopped (the chat closes
 * running calls only on a finish frame); a completed call waits on the owner's click or was skipped.
 */
export function toolStatusOf(call: HostToolCall, streaming: boolean): ToolStatus {
  if (call.state === 'error') return 'failed'
  if (call.state === 'running') return streaming ? 'running' : 'stopped'
  if (call.waiting) return 'waiting'
  return call.skipped ? 'skipped' : 'done'
}

function joined(parts: readonly (string | null | undefined)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(SEP)
}

const TONES: Readonly<Record<ToolStatus, LineTone>> = {
  running: 'running',
  done: 'done',
  failed: 'failed',
  waiting: 'waiting',
  skipped: 'muted',
  stopped: 'muted',
}

const MARKS: Readonly<Record<ToolStatus, string>> = {
  running: MARK_RUNNING,
  done: MARK_DONE,
  failed: MARK_FAILED,
  waiting: MARK_WAITING,
  skipped: MARK_MUTED,
  stopped: MARK_MUTED,
}

function toolText(call: HostToolCall, status: ToolStatus, said: Phrases): string {
  switch (status) {
    case 'running': {
      const detail = toolDetail(call.input)
      return detail ? `${said.running}: '${detail}'` : said.running
    }
    case 'done':
      return joined([said.done, call.summary, toolSeconds(call.durationMs)])
    case 'failed':
      return joined([said.failed, call.error ?? call.summary])
    case 'waiting':
      return joined([WAITING_FOR_YOU, call.summary])
    case 'skipped':
      return joined([`Skipped: ${said.running.toLowerCase()}`, call.summary])
    case 'stopped':
      return `Stopped: ${said.running.toLowerCase()}`
  }
}

export function toolLineLabel(call: HostToolCall, streaming: boolean): ToolLineLabel {
  const status = toolStatusOf(call, streaming)
  const said = phrases(toolActivity(call.toolName), call.toolName)
  return { mark: MARKS[status], text: toolText(call, status, said), tone: TONES[status] }
}
