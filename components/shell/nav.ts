// Navigation model for the kit's shell (PRD-004): pure data and helpers, no React.

export type NavId = "editor" | "preview" | "style" | "examples";

export interface NavItem {
  readonly id: NavId;
  readonly label: string;
  /** The shorter word in the phone tab bar, where four tabs share 390 px. */
  readonly tabLabel: string;
  readonly href: string;
}

/** The kit's four pages, in order: Editor · Preview · Style sheet · Examples. */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: "editor", label: "Editor", tabLabel: "Editor", href: "/" },
  { id: "preview", label: "Preview", tabLabel: "Preview", href: "/preview" },
  { id: "style", label: "Style sheet", tabLabel: "Style", href: "/style" },
  { id: "examples", label: "Examples", tabLabel: "Examples", href: "/examples" },
];

export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
