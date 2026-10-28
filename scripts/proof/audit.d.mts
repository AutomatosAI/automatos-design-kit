// The types of scripts/proof/audit.mjs's exports, for the root tests that import it (tests/proof-audit.test.ts,
// tests/proof-content.test.ts). The transcript's types are transcript.d.mts's, the content check's leak-content.d.mts's.
import type { Fingerprints } from './leak-content.mjs'
import type { ToolCall } from './transcript.mjs'

export declare const TOOLCHAIN_PATHS: readonly string[]
export declare const FLAGS: Readonly<{ leakContent: string; outside: string; leak: string; gitRef: string; web: string; deny: string }>
export declare const WEB_TOOLS: readonly string[]

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
  /** The proof's own folders (themes/<slug>, proof/<id>): the only paths a history walk may print patches for. */
  readonly proofFolders: readonly string[]
  readonly isPath: (word: string) => boolean
  readonly deny: readonly DenyPattern[]
  /** The content check's fingerprints, read from the clone's history; without them (and no error) it does not run. */
  readonly fingerprints?: Fingerprints
  /** Why the content check could not run: flagged as leak-content. */
  readonly contentError?: string
}

export interface AuditReport {
  readonly lines: readonly string[]
  readonly flagged: boolean
}

export type AuditArgs =
  | { readonly error: string }
  | { readonly error?: undefined; readonly transcript: string; readonly clone: string; readonly denyFile?: string }

export declare function absolutePath(path: string, clone: string, home: string): string
export declare function placeOf(path: string, place: Place): 'clone' | 'toolchain' | 'outside'
export declare function namesLeak(path: string, place: Place, leakEntries: readonly string[]): boolean
export declare function isCommandPath(word: string, rootEntries: readonly string[]): boolean
export declare function gitRefProblem(
  args: readonly string[], branch: string, isPath: (word: string) => boolean, proofFolders?: readonly string[],
): string | null
export declare function callFlags(call: ToolCall, context: AuditContext): string[]
export declare function parseDenyList(text: string): DenyPattern[]
export declare function summary(call: ToolCall): string
export declare function audit(events: readonly unknown[], context: AuditContext): AuditReport
export declare function parseArgs(argv: readonly string[]): AuditArgs
export declare function main(argv: readonly string[]): number
