// The types of scripts/proof/transcript.mjs's exports, for the root tests that import it (tests/proof-audit.test.ts,
// tests/proof-content.test.ts).

export interface ToolCall {
  readonly turn: number
  /** The tool_use block's id, which its result names; null when the block has none. */
  readonly id?: string | null
  readonly tool: string
  readonly input: Readonly<Record<string, unknown>>
}

export interface ToolResult {
  /** The turn of the call the result answers, or null when no call in the transcript has its id. */
  readonly turn: number | null
  readonly text: string
}

export interface RunNumbers {
  readonly turns: number | null
  readonly costUsd: number | null
  readonly durationMs: number | null
}

export declare function parseTranscript(text: string): unknown[]
export declare function toolCalls(events: readonly unknown[]): ToolCall[]
export declare function toolResults(events: readonly unknown[]): ToolResult[]
export declare function runSummary(events: readonly unknown[]): RunNumbers | null
