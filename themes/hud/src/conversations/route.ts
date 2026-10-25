/**
 * The address of HUD's own route, Conversations. A theme's route `<name>` is served at /x/<name> (the host's theme
 * routes); HUD names its route, so it names the address too: the SDK has no route-address builder. theme.json's
 * `routes` and its nav entry say the same, and test/conversations/conversations-page.test.tsx holds them equal.
 */

/** Where the host serves every theme route. */
const THEME_ROUTE_PREFIX = '/x/'

export const CONVERSATIONS_ROUTE = 'conversations'
export const CONVERSATIONS_HREF = `${THEME_ROUTE_PREFIX}${CONVERSATIONS_ROUTE}`
