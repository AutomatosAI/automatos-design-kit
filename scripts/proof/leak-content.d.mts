// The types of scripts/proof/leak-content.mjs's exports, for the root tests that import it
// (tests/proof-content.test.ts, tests/proof-launch.test.ts) and scripts/proof/audit.d.mts.

export declare const MIN_FINGERPRINT_LENGTH: number
export declare const FINGERPRINT_MAX: number
export declare const REMOVAL_SUBJECT: RegExp

export interface LeakText {
  readonly path: string
  readonly text: string
}

export interface Fingerprints {
  /** The leak files' lines no other file of the base holds, whole or inside a line. */
  readonly lines: readonly { readonly file: string; readonly line: string }[]
  /** The leak files' whole texts (trimmed), as sha256, for the files with a line no other file holds. */
  readonly hashes: readonly { readonly file: string; readonly sha256: string }[]
  /** How many leak text files the base has. */
  readonly files: number
}

export interface LeakSeen {
  readonly file: string
  readonly turn: number | null
}

export declare function fingerprints(input: { readonly leakFiles: readonly LeakText[]; readonly otherLines: Iterable<string> }): Fingerprints
export declare function findLeakContent(events: readonly unknown[], prints: Fingerprints): LeakSeen[]
export declare function findBase(clone: string): string
export declare function parseBatch(output: Buffer): Buffer[]
export declare function baseTexts(clone: string, base: string): LeakText[]
export declare function baseFingerprints(clone: string, base: string): Fingerprints
