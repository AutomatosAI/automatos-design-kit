// Navigation model for the app shell: pure data and helpers, no React.

export type NavId =
  | "chat"
  | "conversations"
  | "missions"
  | "board"
  | "playbooks"
  | "agents"
  | "deliverables"
  | "knowledge"
  | "analytics"
  | "looks";

export type NavGroupId = "talk" | "work" | "crew" | "library" | "insights" | "look";

export interface NavItem {
  readonly id: NavId;
  readonly label: string;
  readonly href: string;
  /** False hides the item until its page is built (PRD-003: wave 4's pages during wave 3). */
  readonly ready: boolean;
}

export interface NavGroup {
  readonly id: NavGroupId;
  /** The small caps label over the group in the sidebar; null for Look, which stands alone. */
  readonly label: string | null;
  readonly items: readonly NavItem[];
}

/** Every page, grouped as in PRD-003 section 4, ready or not. */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "talk",
    label: "Talk",
    items: [
      { id: "chat", label: "Chat", href: "/", ready: true },
      { id: "conversations", label: "Conversations", href: "/conversations", ready: true },
    ],
  },
  {
    id: "work",
    label: "Work",
    items: [
      { id: "missions", label: "Missions", href: "/missions", ready: true },
      { id: "board", label: "Board", href: "/board", ready: true },
      { id: "playbooks", label: "Playbooks", href: "/playbooks", ready: false },
    ],
  },
  {
    id: "crew",
    label: "Crew",
    items: [{ id: "agents", label: "Agents", href: "/agents", ready: true }],
  },
  {
    id: "library",
    label: "Library",
    items: [
      { id: "deliverables", label: "Deliverables", href: "/deliverables", ready: true },
      { id: "knowledge", label: "Knowledge", href: "/knowledge", ready: true },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [{ id: "analytics", label: "Analytics", href: "/analytics", ready: false }],
  },
  {
    id: "look",
    label: null,
    items: [{ id: "looks", label: "Look", href: "/looks", ready: true }],
  },
];

/** The groups with only their ready items; a group with none left is dropped. */
export function visibleGroups(groups: readonly NavGroup[] = NAV_GROUPS): readonly NavGroup[] {
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.ready) }))
    .filter((group) => group.items.length > 0);
}

/** Every ready item, in sidebar order. */
export const NAV_ITEMS: readonly NavItem[] = visibleGroups().flatMap((group) => group.items);

function readyItem(id: NavId, label: string): NavItem | null {
  const item = NAV_ITEMS.find((candidate) => candidate.id === id);
  return item ? { ...item, label } : null;
}

/**
 * The phone tab bar (PRD-003): Chats is the conversation list, then Missions and
 * Shelf (the Deliverables). The fourth tab is the More button (PhoneBars.tsx).
 */
export const PHONE_TABS: readonly NavItem[] = [
  readyItem("conversations", "Chats"),
  readyItem("missions", "Missions"),
  readyItem("deliverables", "Shelf"),
].filter((item): item is NavItem => item !== null);

/**
 * What the More sheet lists: every ready page without a tab of its own, Look
 * last. The chat is left out: Chats leads to it, and its list has New chat.
 */
export const MORE_ITEMS: readonly NavItem[] = NAV_ITEMS.filter(
  (item) => item.id !== "chat" && !PHONE_TABS.some((tab) => tab.id === item.id),
);

/**
 * Routes that show the phone tab bar: every list page (ready or not, so wave 4's
 * pages need no change here). Not the chat, which has the top bar.
 */
const TAB_BAR_ROUTES: ReadonlySet<string> = new Set(
  NAV_GROUPS.flatMap((group) => group.items)
    .map((item) => item.href)
    .filter((href) => href !== "/"),
);

export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** True when the current page is one of the More sheet's, so the More tab reads as current. */
export function isMoreActive(pathname: string): boolean {
  return MORE_ITEMS.some((item) => isActive(item.href, pathname));
}

export interface PhoneChrome {
  readonly topBar: boolean;
  readonly tabBar: boolean;
}

/**
 * Which phone bars a route shows: the chat has the top bar (Chats · title ·
 * Shelf); every list page and the Looks page have the bottom tab bar; a detail
 * page (a Deliverable, a Mission, an agent), the style page and the 404 bring
 * their own back link.
 */
export function phoneChrome(pathname: string): PhoneChrome {
  if (pathname === "/") return { topBar: true, tabBar: false };
  if (TAB_BAR_ROUTES.has(pathname)) return { topBar: false, tabBar: true };
  return { topBar: false, tabBar: false };
}
