// The types of scripts/release/bumped.mjs's exports, for the root tests that import it (tests/release-bumped.test.ts).
import type { ReleaseTag } from './themes.mjs'

export interface Theme {
  readonly slug: string
  readonly publisher: string
  readonly id: string
  readonly version: string
}

export interface Picked extends Theme {
  readonly dir: string
  readonly tag: string
  readonly packageName: string
  readonly commit: string
}

export type Identified = { readonly theme: Theme } | { readonly skip: string } | { readonly error: string }
export type Decision = { readonly pick: Theme; readonly message: string } | { readonly skip: string }

export interface BumpedIo {
  readonly out: (text: string) => void
  readonly err: (text: string) => void
}

export declare const EXIT_OK: number
export declare const EXIT_REFUSED: number
export declare const EXIT_USAGE: number
export declare function identify(folder: string, manifest: unknown, publishers: readonly string[]): Identified
export declare function picked(theme: Theme, commit: string): Picked
export declare function decide(theme: Theme, tags: readonly ReleaseTag[]): Decision
export declare function main(argv: readonly string[], io?: BumpedIo): number
export declare function isMain(moduleUrl: string): boolean
