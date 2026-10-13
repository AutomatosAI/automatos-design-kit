// Navigation model for the app shell: pure data and helpers, no React.

export type NavId = "chat" | "conversations" | "deliverables";

export interface NavItem {
  readonly id: NavId;
  readonly label: string;
  readonly href: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "chat", label: "Chat", href: "/" },
  { id: "conversations", label: "Conversations", href: "/conversations" },
  { id: "deliverables", label: "Deliverables", href: "/deliverables" },
];

/** The phone tab bar (mocks 03 and 04): Chats is the conversation list, Shelf the Deliverables. */
export const PHONE_TABS: readonly NavItem[] = [
  { id: "conversations", label: "Chats", href: "/conversations" },
  { id: "deliverables", label: "Shelf", href: "/deliverables" },
];

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
 * top bar (Chats · title · Shelf); the two lists have the bottom tab bar;
 * a Deliverable's detail and the 404 bring their own back link.
 */
export function phoneChrome(pathname: string): PhoneChrome {
  if (pathname === "/") return { topBar: true, tabBar: false };
  if (pathname === "/conversations" || pathname === "/deliverables") {
    return { topBar: false, tabBar: true };
  }
  return { topBar: false, tabBar: false };
}
