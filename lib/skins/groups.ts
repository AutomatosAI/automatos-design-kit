import type { TokenName } from "./format";

// The editor's colour groups (PRD-004 K-004). Every allowed token is in exactly one group
// (tests/skins/editor-lib.test.ts). Pure; relative imports only (the CLI runs lib/skins under tsx).

export interface ColourGroup {
  readonly id: string;
  readonly label: string;
  readonly tokens: readonly TokenName[];
}

export const COLOUR_GROUPS: readonly ColourGroup[] = [
  {
    id: "surfaces",
    label: "Surfaces",
    tokens: ["background", "card", "popover", "muted", "secondary", "border", "input"],
  },
  {
    id: "text",
    label: "Text",
    tokens: [
      "foreground",
      "card-foreground",
      "popover-foreground",
      "primary-foreground",
      "secondary-foreground",
      "muted-foreground",
      "accent-foreground",
      "destructive-foreground",
      "success-foreground",
      "warning-foreground",
      "info-foreground",
      "agent-foreground",
    ],
  },
  { id: "brand", label: "Brand", tokens: ["primary", "accent", "ring", "destructive"] },
  { id: "status", label: "Status", tokens: ["success", "warning", "info", "agent"] },
  {
    id: "charts",
    label: "Charts",
    tokens: [
      "chart-1",
      "chart-2",
      "chart-3",
      "chart-4",
      "chart-5",
      "stage-1",
      "stage-2",
      "stage-3",
      "stage-4",
      "stage-5",
      "stage-6",
      "stage-7",
      "stage-8",
      "stage-9",
    ],
  },
  {
    id: "aliases",
    label: "Studio aliases",
    tokens: ["olive", "warn-ink", "on-strong", "border-2", "accent-2", "navy"],
  },
];

export const FIRST_GROUP = COLOUR_GROUPS[0];

export function groupById(id: string): ColourGroup {
  return COLOUR_GROUPS.find((group) => group.id === id) ?? FIRST_GROUP;
}
