import type { HostToolCall } from '@automatos/theme-sdk'

import { toolLineLabel } from './labels'
import styles from './reply.module.css'

/**
 * One mono line per tool call of Auto's reply (after Play's tool lines, themes/play/src/components/play/chat/
 * tool-lines.tsx, Play 1.1.1): a glyph and the words, "▸ Searching the web: '…'" while it runs, "✓ Searched the
 * web · 3 results · 2.1 s" once done, a failure in words, and "Waiting for you" on an ask for the owner's click.
 * The glyph is decoration: the words say the state.
 */

export const TOOL_LINES_LABEL = 'Tools Auto used'

function ToolLine({ call, streaming }: { readonly call: HostToolCall; readonly streaming: boolean }) {
  const label = toolLineLabel(call, streaming)
  return (
    <li className={styles.toolLine} data-tone={label.tone}>
      <span className={styles.mark} aria-hidden="true">
        {label.mark}
      </span>
      <span>{label.text}</span>
    </li>
  )
}

export interface ToolLinesProps {
  readonly calls: readonly HostToolCall[]
  /** The reply is being written: a running call runs; on a finished reply it was stopped. */
  readonly streaming: boolean
}

export function ToolLines({ calls, streaming }: ToolLinesProps) {
  if (calls.length === 0) return null
  return (
    <ul className={styles.toolLines} aria-label={TOOL_LINES_LABEL}>
      {calls.map((call) => (
        <ToolLine key={call.toolCallId} call={call} streaming={streaming} />
      ))}
    </ul>
  )
}
