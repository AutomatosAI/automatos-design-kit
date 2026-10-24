/**
 * PRD-261 B-02e: the module vite.harness.config.ts serves the theme folder through. Its values are the folder's own
 * files, unchecked: app/main.tsx checks them (src/host/register.ts readServedTheme) before anything draws.
 */
declare module 'virtual:automatos-harness/theme' {
  /** theme.json, looks/presets/*.look.json (in file-name order) and boot/prepaint.json (null when there is none). */
  export const files: {
    readonly manifest: unknown
    readonly presets: readonly unknown[]
    readonly prepaint: unknown
  }
  /** Every file under the folder's assets/, as 'assets/<path>', sorted: what the phone view may give a URL for. */
  export const assets: readonly string[]
  /** Imports the theme's src/entry.ts, with @automatos/theme-sdk mapped to the harness's fake SDK. */
  export function loadEntry(): Promise<unknown>
}
