/**
 * Who this theme is, in the words its screens show, and the one mark the host looks for on them.
 */

/** theme.json's name: the frame's wordmark. */
export const THEME_NAME = 'Candy'

/**
 * Spread on the <h1> of a screen the theme draws in a host page (the look editor, the style sheet), with
 * tabIndex={-1}: once the screen shows, the host moves the focus that dropped to <body> to the element carrying it.
 */
export const THEME_HEADING = { 'data-theme-heading': true } as const
