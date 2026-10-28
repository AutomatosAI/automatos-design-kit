// The types of scripts/proof/guard.mjs's exports, for the root tests that import it (tests/proof.test.ts).

export declare const LEAK_LIST: string
export declare const LOCKFILE: string
export declare const PROOF_ROOT: string
export declare const THEMES_ROOT: string
export declare const BASE_FILE: string
export declare const BRANCH_PREFIX: string
export declare const ID_PATTERN: RegExp
export declare const SLUG_PATTERN: RegExp
export declare const TAG_PATTERN: RegExp

export interface NameStatus {
  readonly status: string
  readonly path: string
}

export interface GuardInput {
  readonly changes: readonly NameStatus[]
  readonly id: string
  readonly slug: string
  readonly leakEntries: readonly string[]
  readonly headFiles: readonly string[]
  readonly themeAtBase: boolean
  readonly lock: readonly string[]
}

export interface Proof {
  readonly id: string
  readonly slug: string
  readonly base: string
}

export interface LockFile {
  readonly packages?: Readonly<Record<string, unknown>>
  readonly [field: string]: unknown
}

export declare function parseLeakList(text: string): string[]
export declare function globToRegExp(glob: string): RegExp
export declare function isLeakPath(path: string, entries: readonly string[]): boolean
export declare function shown(path: string): string
export declare function parseNameStatus(output: string): NameStatus[]
export declare function inScope(path: string, id: string, slug: string): boolean
export declare function guardFindings(input: GuardInput): string[]
export declare function lockFindings(baseLock: LockFile, headLock: LockFile, slug: string, packageName: string | undefined): string[]
export declare function resolveProof(headRef: string, baseFiles: ReadonlyArray<{ readonly path: string; readonly text: string }>): Proof
export declare function runGuard(baseRef: string, id: string, slug: string): string[]
export declare function main(argv: readonly string[]): number
export declare function isMain(moduleUrl: string): boolean
