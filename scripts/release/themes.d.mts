// The types of scripts/release/themes.mjs's exports, for the root tests that import it.

export interface ReleaseTag {
  readonly version: string
  readonly objectId: string
}

export declare const THEMES_DIR: string
export declare const PACKAGES_DIR: string
export declare const MANIFEST_FILE: string
export declare const PACKAGE_JSON: string
export declare const PUBLISHERS_FILE: string
export declare const REMOTE: string
export declare const MAIN_REF: string
export declare const TAG_PATTERN: RegExp
export declare const VERSION_PATTERN: RegExp
export declare const ID_PATTERN: RegExp
export declare const CORE_VERSION_PATTERN: RegExp
export declare const PUBLISHER_PATTERN: RegExp
export declare const SLUG_PATTERN: RegExp
export declare const PACKED_TOP_FILES: readonly string[]
export declare const PACKED_FOLDERS: readonly string[]
export declare const SOURCE_DIR: string

export declare function messageOf(error: unknown): string
export declare function isRecord(value: unknown): value is Record<string, unknown>
export declare function compareVersions(a: string, b: string): number
export declare function tagPrefixOf(slug: string): string
export declare function tagOf(slug: string, version: string): string
export declare function themeDirOf(slug: string): string
export declare function manifestPathOf(slug: string): string
export declare function packageNameOf(id: string): string
export declare function parseTag(tag: unknown): { readonly slug: string; readonly version: string } | null
export declare function releaseTags(slug: string, listing: string): ReleaseTag[]
export declare function latestOf(tags: readonly ReleaseTag[]): ReleaseTag | undefined
export declare function parsePublishers(text: string): string[]
export declare function readJson(root: string, rel: string): unknown
export declare function readPublishers(root: string): string[]
export declare function themeFolders(root: string): string[]
export declare function bundledSources(root: string, slug: string): string[]
export declare function packedPathsOf(root: string, slug: string): string[]
export declare function git(what: string, args: readonly string[], cwd: string): string
export declare function listReleaseTags(slug: string, cwd: string): ReleaseTag[]
