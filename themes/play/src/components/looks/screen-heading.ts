/**
 * PRD-260 P260-FX-22 (M21), PRD-261 A-14d — the mark on the h1 of a screen only Play has (Make it
 * yours, the style sheet). After 'Switch to Play' the host's note is replaced by the screen, and the
 * host's ThemeSlotPage moves the focus that dropped to <body> to the element it finds by
 * SCREEN_HEADING_SELECTOR (lib/theme-host/builtin/play-only-route.tsx). The SDK has no name for
 * that mark, so Play keeps its own copy of the attribute;
 * components/looks/__tests__/copied-helpers.test.tsx holds it to the host's selector.
 *
 * PRD-261 K-19c (host 1.1.0): the h1 also carries data-theme-heading, the mark the host's look runtime
 * looks for under any installed theme (A-19d2), beside builtin Play's data-play-only-heading.
 */

/** Spread on a Play-only screen's h1 (with tabIndex={-1}): where focus goes after Switch to Play. */
export const PLAY_ONLY_HEADING = { 'data-play-only-heading': true, 'data-theme-heading': true } as const
