/** The plugin's name and version, read from its package.json, for ESLint's plugin and parser meta. */
import { readFileSync } from 'node:fs'

export interface PackageMeta {
  readonly name: string
  readonly version: string
}

const MANIFEST = new URL('../package.json', import.meta.url)

function readMeta(): PackageMeta {
  const parsed: unknown = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const { name, version } = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<string, unknown>
  if (typeof name !== 'string' || typeof version !== 'string') {
    throw new Error(`${MANIFEST.pathname} has no string name and version.`)
  }
  return Object.freeze({ name, version })
}

export const PACKAGE: PackageMeta = readMeta()
