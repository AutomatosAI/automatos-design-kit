// The types of scripts/proof/audit.mjs's exports, for the root tests that import it (tests/proof-audit.test.ts).

export declare const TOOLCHAIN_PATHS: readonly string[]
export declare const FLAGS: Readonly<{ outside: string; leak: string; gitRef: string; web: string; deny: string }>
export declare const WEB_TOOLS: readonly string[]

export interface ToolCall {
  readonly turn: number
  readonly tool: string
  readonly input: Readonly<Record<string, unknown>>
}

export interface RunNumbers {
  readonly turns: number | null
  readonly costUsd: number | null
  readonly durationMs: number | null
}

export interface Place {
  /** The clone's paths: as given, and its real path. */
  readonly roots: readonly string[]
  readonly home: string
  /** Paths outside the clone a run may name. */
  readonly toolchain: readonly string[]
  /** The names at /. */
  readonly rootEntries: readonly string[]
}

export interface DenyPattern {
  readonly line: number
  readonly pattern: string
}

export interface AuditContext {
  readonly place: Place
  readonly leakEntries: readonly string[]
  readonly branch: string
  readonly isPath: (word: string) => boolean
  readonly deny: readonly DenyPattern[]
}

export interface AuditReport {
  readonly lines: readonly string[]
  readonly flagged: boolean
}

export type AuditArgs =
  | { readonly error: string }
  | { readonly error?: undefined; readonly transcript: string; readonly clone: string; readonly denyFile?: string }

export declare function parseTranscript(text: string): unknown[]
export declare function toolCalls(events: readonly unknown[]): ToolCall[]
export declare function runSummary(events: readonly unknown[]): RunNumbers | null
export declare function absolutePath(path: string, clone: string, home: string): string
export declare function placeOf(path: string, place: Place): 'clone' | 'toolchain' | 'outside'
export declare function namesLeak(path: string, place: Place, leakEntries: readonly string[]): boolean
export declare function commandWords(command: string): string[]
export declare function isCommandPath(word: string, rootEntries: readonly string[]): boolean
export declare function gitInvocations(command: string): string[][]
export declare function gitLocations(command: string): string[]
export declare function gitRefProblem(args: readonly string[], branch: string, isPath: (word: string) => boolean): string | null
export declare function callFlags(call: ToolCall, context: AuditContext): string[]
export declare function parseDenyList(text: string): DenyPattern[]
export declare function summary(call: ToolCall): string
export declare function audit(events: readonly unknown[], context: AuditContext): AuditReport
export declare function parseArgs(argv: readonly string[]): AuditArgs
export declare function main(argv: readonly string[]): number
