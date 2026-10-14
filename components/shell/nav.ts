// Navigation model for the app shell: pure data and helpers, no React.

export type NavId = "chat" | "conversations" | "deliverables" | "looks";

export interface NavItem {
  readonly id: NavId;
  readonly label: string;
  readonly href: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "chat", label: "Chat", href: "/" },
  { id: "conversations", label: "Conversations", href: "/conversations" },
  { id: "deliverables", label: "Deliverables", href: "/deliverables" },
  { id: "looks", label: "Look", href: "/looks" },
];

/**
 * The phone tab bar (mocks 03 and 04): Chats is the conversation list, Shelf the Deliverables,
 * Look the Looks page (PRD-002 L-004), so phones can reach it too.
 */
export const PHONE_TABS: readonly NavItem[] = [
  { id: "conversations", label: "Chats", href: "/conversations" },
  { id: "deliverables", label: "Shelf", href: "/deliverables" },
  { id: "looks", label: "Look", href: "/looks" },
];

/** Routes that show the phone tab bar: the two lists and the Looks page. */
const TAB_BAR_ROUTES: ReadonlySet<string> = new Set(["/conversations", "/deliverables", "/looks"]);

export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface PhoneChrome {
  readonly topBar: boolean;
  readonly tabBar: boolean;
}

/**
 * Which phone bars a route shows, as in the phone mocks: the chat has the
 * top bar (Chats · title · Shelf); the two lists and the Looks page have the
 * bottom tab bar; a Deliverable's detail and the 404 bring their own back link.
 */
export function phoneChrome(pathname: string): PhoneChrome {
  if (pathname === "/") return { topBar: true, tabBar: false };
  if (TAB_BAR_ROUTES.has(pathname)) return { topBar: false, tabBar: true };
  return { topBar: false, tabBar: false };
}
