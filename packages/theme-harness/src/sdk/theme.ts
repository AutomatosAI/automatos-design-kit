/**
 * PRD-261 B-02b: the fake of SDK area `theme`. It mirrors core's frontend/lib/theme-sdk/theme.ts:6, which
 * re-exports frontend/lib/theme-host/sdk.ts (at 101a0bf33f64fb4f89af81b4293415be60b661ac): the same check and
 * freeze, and the version the vendored types carry (packages/theme-sdk/package.json, which is the host
 * build's sdkVersion).
 */
import sdkPackage from '@automatos/theme-sdk/package.json'
import type { ThemeDefinition } from '@automatos/theme-sdk'

type Sdk = typeof import('@automatos/theme-sdk')

/** theme-host/sdk.ts:14: the SDK version the host serves, here the vendored package's. */
export const SDK_VERSION = sdkPackage.version satisfies Sdk['SDK_VERSION']

function isThemeDefinition(value: unknown): value is ThemeDefinition {
  return typeof value === 'object' && value !== null && typeof (value as { register?: unknown }).register === 'function'
}

/** theme-host/sdk.ts:21: a theme's definition, checked and frozen; a TypeError without register(host). */
export const defineTheme = ((definition: ThemeDefinition): Readonly<ThemeDefinition> => {
  if (!isThemeDefinition(definition)) throw new TypeError('defineTheme needs a register(host) function.')
  return Object.freeze({ ...definition })
}) satisfies Sdk['defineTheme']
