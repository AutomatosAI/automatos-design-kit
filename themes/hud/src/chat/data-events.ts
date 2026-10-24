// Copied from themes/play/src/lib/mascot/data-events.ts (Play 1.1.1) as it is, but for the comments: the chat's
// data parts as Auto's events.
import { liveReceiptsOf } from '@automatos/theme-sdk'

import type { JsonObject, MascotEvent } from '@automatos/mascot/types'

/**
 * The chat controller hands a theme's onData each data part of the stream as `{type, data}`: 'tool-start',
 * 'tool-end', 'tool-data' (the turn's receipts ride one under `receipts`), 'memory-injected', 'workflow-update',
 * 'mission-suggestion' and a few that never move Auto. They come off the wire, so every field is checked here: a
 * part that isn't what it says maps to nothing. The receipts are read by the SDK (liveReceiptsOf) exactly as the
 * reply reads them. The status and the newest reply are @automatos/mascot's events. Pure.
 */

/** The chat's own name for a tool-start without one. */
const UNNAMED_TOOL = 'tool'

type Part = { readonly type?: unknown; readonly data?: unknown }

function recordOf(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : null
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function numberOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toolCallIdOf(data: JsonObject): string | null {
  const id = textOf(data.toolCallId)
  return id ? id : null
}

function toolStart(data: JsonObject): MascotEvent[] {
  const toolCallId = toolCallIdOf(data)
  if (toolCallId === null) return []
  const toolName = textOf(data.toolName) || UNNAMED_TOOL
  return [{ type: 'tool-start', toolCallId, toolName, input: recordOf(data.input) ?? {} }]
}

/** A skipped call is no failure, and an ask (waiting) is Auto waiting for the owner. */
function toolEnd(data: JsonObject): MascotEvent[] {
  const toolCallId = toolCallIdOf(data)
  if (toolCallId === null) return []
  return [{
    type: 'tool-end',
    toolCallId,
    toolName: textOf(data.toolName) || UNNAMED_TOOL,
    success: data.success === true,
    error: textOf(data.error),
    durationMs: numberOf(data.durationMs),
    summary: textOf(data.summary),
    skipped: data.skipped === true,
    waiting: data.waiting === true,
  }]
}

/** The turn's receipts, read by the SDK exactly as the reply reads them. */
function receipts(part: Part): MascotEvent[] {
  const live = liveReceiptsOf(part)
  if (live === null) return []
  return [{ type: 'receipts', receipts: live.receipts, model: live.model, above: live.above }]
}

function memoryInjected(data: JsonObject): MascotEvent[] {
  const memories = Array.isArray(data.memories) ? data.memories : []
  return [{ type: 'memory-injected', memories, totalMatched: numberOf(data.totalMatched) ?? memories.length }]
}

function workflowUpdate(data: JsonObject): MascotEvent[] {
  return [{
    type: 'workflow-update',
    workflowId: textOf(data.workflowId) ?? '',
    status: textOf(data.status) ?? '',
    currentStep: textOf(data.currentStep),
    progress: numberOf(data.progress),
  }]
}

/**
 * What one onData part means for Auto. A mission suggestion, the usage, the agent's info, a stored memory, a
 * tool-data part that carries no receipts and any part this version doesn't know map to nothing.
 */
export function mascotEventsFromData(part: unknown): MascotEvent[] {
  const forwarded = recordOf(part) as Part | null
  const data = recordOf(forwarded?.data)
  if (forwarded === null || data === null) return []
  switch (forwarded.type) {
    case 'tool-start':
      return toolStart(data)
    case 'tool-end':
      return toolEnd(data)
    case 'tool-data':
      return receipts(forwarded)
    case 'memory-injected':
      return memoryInjected(data)
    case 'workflow-update':
      return workflowUpdate(data)
    default:
      return []
  }
}
