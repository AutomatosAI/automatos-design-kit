/**
 * PRD-260 P260-FX-22 (M21), PRD-261 A-14d — the mark on the h1 of a screen only Play has (Make it
 * yours, the style sheet). Once the screen replaces the host's note, the host's ThemeSlotPage moves
 * the focus that dropped to <body> to the element it finds by THEME_HEADING_SELECTOR,
 * '[data-theme-heading]' (core's components/theme-host/no-look-editor-note.tsx), the mark any
 * installed theme's screen puts on its h1. The SDK has no name for that mark, so Play keeps its own
 * copy of the attribute; test/looks/copied-helpers.test.tsx holds it to the host's selector.
 *
 * PRD-261 K-21 (Play 1.1.1): data-theme-heading is the only mark. Builtin Play's own, which only its
 * host in core looked for, left with builtin Play (A-19).
 */

/** Spread on a Play-only screen's h1 (with tabIndex={-1}): where the host hands focus once the screen shows. */
export const PLAY_ONLY_HEADING = { 'data-theme-heading': true } as const
