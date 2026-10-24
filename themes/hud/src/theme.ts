/**
 * Spread on the <h1> of a screen HUD draws in a host page (the look editor, the style sheet), with tabIndex={-1}:
 * once the screen shows, the host moves the focus that dropped to <body> to the element carrying it.
 */
export const THEME_HEADING = { 'data-theme-heading': true } as const
