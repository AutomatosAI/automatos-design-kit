import { CHAT_HREF, type HostSearchParams } from '@automatos/theme-sdk'

/**
 * Where the host draws HUD's core screen (src/pages/chat.tsx): at /chat, unless the link carries one of the
 * parameters theme.json's pages["/chat"].keepCorePage lists, for which the host draws its own chat page instead
 * (test/chat/chat-page.test.tsx holds the two lists equal). The frame reads it so Auto shows once on a screen: in
 * the core while HUD's core screen is drawn, in the rail's dock everywhere else. Pure.
 */

/** theme.json's pages["/chat"].keepCorePage: the link parameters for which the host keeps its own chat page. */
export const CHAT_KEEPS_CORE_PAGE: readonly string[] = ['repo', 'runtime', 'mode']

/** True where the host draws HUD's core screen: `pathname` is /chat and no parameter keeps core's page. */
export function showsCoreScreen(pathname: string, params: HostSearchParams): boolean {
  return pathname === CHAT_HREF && !CHAT_KEEPS_CORE_PAGE.some((name) => params.has(name))
}
