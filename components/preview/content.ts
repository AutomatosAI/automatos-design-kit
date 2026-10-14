// The preview gallery's words: a made-up workspace drawn the way Studio draws it (the sidebar's
// groups come from Studio's lib/studio-menu.ts). Canonical words only: Auto, Mission,
// Deliverable, Playbook. No colour lives here: the CSS reads Studio's tokens.

export const GALLERY_HEADING = "Preview";
export const GALLERY_LEAD =
  "Your skin on components shaped like Studio's, coloured by the same CSS Studio will generate. Switch the base and the tone, or compare with Studio as it ships.";
export const GALLERY_CSS_TEST_ID = "gallery-css";
export const SKIN_FRAME_LABEL = "Your skin";
export const COMPARE_LABEL = "Compare with Studio";

export interface SidebarGroup {
  readonly group: string;
  readonly items: readonly { readonly label: string; readonly count?: string; readonly alert?: boolean }[];
}

export const ACTIVE_NAV_ITEM = "Chat";

export const SIDEBAR_GROUPS: readonly SidebarGroup[] = [
  {
    group: "Operations",
    items: [
      { label: "Chat" },
      { label: "Command Centre" },
      { label: "Assignments", count: "2", alert: true },
      { label: "Deliverables", count: "3" },
    ],
  },
  {
    group: "Workforce",
    items: [{ label: "Agent Management" }, { label: "Tools & Integrations" }, { label: "Knowledge Base" }, { label: "Marketplace" }],
  },
  { group: "Workspace", items: [{ label: "Team Management" }, { label: "Analytics" }] },
];

export const PAGE_HEADER = {
  eyebrow: "Operations",
  title: "Your",
  accent: "Missions",
  sub: "Every Mission Auto has run for this workspace, newest first.",
  action: "New Mission",
} as const;

/** Studio's stat tones (components/shared/stats-bar.tsx statTone): ok, err, warn, info. */
export type StatTone = "plain" | "ok" | "err" | "warn" | "info";

export const STATS: readonly { readonly label: string; readonly value: string; readonly tone: StatTone; readonly delta: string }[] = [
  { label: "Missions", value: "128", tone: "plain", delta: "+12 this week" },
  { label: "Done", value: "117", tone: "ok", delta: "91%" },
  { label: "Running", value: "4", tone: "info", delta: "now" },
  { label: "Needs you", value: "2", tone: "warn", delta: "oldest 1 h" },
  { label: "Failed", value: "5", tone: "err", delta: "3 retried" },
];

export const FILTER_TABS: readonly { readonly label: string; readonly count: number }[] = [
  { label: "All", count: 128 },
  { label: "Active", count: 4 },
  { label: "Needs you", count: 2 },
  { label: "Done", count: 117 },
  { label: "Failed", count: 5 },
];

export const USER_MESSAGE = "Draft the weekly report from this week's Missions and save the steps as a Playbook.";
export const AUTO_ANSWER =
  "Done. I read this week's Missions, wrote the report as a Deliverable, and saved the steps as a Playbook you can run every Friday. Posting it to #team failed: the channel is archived.";

export type ToolState = "running" | "done" | "failed";

export const TOOL_STATE_WORDS: Readonly<Record<ToolState, string>> = { running: "Running", done: "Done", failed: "Failed" };

export const TOOL_LINES: readonly { readonly state: ToolState; readonly text: string; readonly detail: string }[] = [
  { state: "done", text: "Read 12 Missions", detail: "1.2 s" },
  { state: "done", text: "Wrote the weekly report", detail: "4.8 s" },
  { state: "failed", text: "Posted to #team", detail: "the channel is archived" },
  { state: "running", text: "Saving the Playbook", detail: "" },
];

export const RECEIPTS_TITLE = "What I did";

export const RECEIPTS: readonly { readonly ok: boolean; readonly text: string }[] = [
  { ok: true, text: "Read 12 Missions" },
  { ok: true, text: "Wrote the Deliverable “Weekly report”" },
  { ok: false, text: "Couldn't post to #team (refused)" },
  { ok: true, text: "Saved the Playbook “Friday report”" },
];

export const DELIVERABLE = { title: "Weekly report", meta: "Deliverable · Markdown · 2 pages", action: "Open" } as const;
export const COMPOSER = { placeholder: "Message Auto", send: "Send" } as const;

export type BadgeTone = "success" | "warning" | "info" | "destructive";

export const TABLE_COLUMNS = ["Mission", "Agent", "Status", "Updated"] as const;

export const TABLE_ROWS: readonly {
  readonly mission: string;
  readonly agent: string;
  readonly status: string;
  readonly tone: BadgeTone;
  readonly updated: string;
}[] = [
  { mission: "Weekly report", agent: "Writer", status: "Done", tone: "success", updated: "2 min ago" },
  { mission: "Tidy the inbox", agent: "Ops", status: "Running", tone: "info", updated: "now" },
  { mission: "Renew the domain", agent: "Ops", status: "Needs you", tone: "warning", updated: "1 h ago" },
  { mission: "Post to #team", agent: "Writer", status: "Failed", tone: "destructive", updated: "3 min ago" },
];

export const BUTTONS: readonly { readonly kind: "primary" | "secondary" | "outline" | "destructive" | "ghost"; readonly label: string }[] = [
  { kind: "primary", label: "Run Playbook" },
  { kind: "secondary", label: "Duplicate" },
  { kind: "outline", label: "Edit" },
  { kind: "destructive", label: "Delete" },
  { kind: "ghost", label: "More" },
];

export const MODAL = {
  title: "Delete this Playbook?",
  body: "“Friday report” and its schedule go. The Deliverables it made stay.",
  cancel: "Cancel",
  confirm: "Delete Playbook",
} as const;

export const TOASTS: readonly { readonly tone: "success" | "destructive"; readonly title: string; readonly text: string }[] = [
  { tone: "success", title: "Mission started", text: "Auto is on it. You can leave this page." },
  { tone: "destructive", title: "Couldn't save the Playbook", text: "Your Automatos didn't answer. Try again." },
];

/** Five series, one per chart token, for the bar chart (Deliverables by kind this week). */
export const BAR_SERIES: readonly { readonly label: string; readonly value: number }[] = [
  { label: "Reports", value: 18 },
  { label: "Code", value: 31 },
  { label: "Sheets", value: 12 },
  { label: "Images", value: 24 },
  { label: "Other", value: 7 },
];

/** Two lines over seven days (Missions done, Missions failed), on chart-1 and chart-2. */
export const LINE_SERIES: readonly { readonly label: string; readonly values: readonly number[] }[] = [
  { label: "Missions done", values: [12, 18, 15, 22, 19, 26, 24] },
  { label: "Missions failed", values: [2, 1, 3, 1, 2, 0, 1] },
];
