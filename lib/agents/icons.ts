import type { AgentSummary } from "@/lib/agents/types";

// An agent's icon (agents-playbooks.md: there is no avatar field, so pick one from
// marketplace_category or agent_type). The categories and the legacy names are Studio's
// own (frontend/lib/agent-constants.ts); Play draws each as a text glyph (none with an
// emoji form, so it takes the Look's colour) with its word. Pure.

export type AgentCategory = { readonly key: string; readonly label: string; readonly glyph: string };

const CUSTOM: AgentCategory = { key: "custom", label: "Custom", glyph: "◇" };

const CATEGORIES: readonly AgentCategory[] = [
  { key: "analytics", label: "Analytics", glyph: "▤" },
  { key: "business", label: "Business", glyph: "▣" },
  { key: "communication", label: "Communication", glyph: "❝" },
  { key: "design", label: "Design", glyph: "◩" },
  { key: "development", label: "Development", glyph: "⌘" },
  { key: "education", label: "Education", glyph: "✎" },
  { key: "general", label: "General", glyph: "◎" },
  { key: "hr", label: "HR", glyph: "◉" },
  { key: "legal", label: "Legal", glyph: "§" },
  { key: "marketing", label: "Marketing", glyph: "✦" },
  { key: "productivity", label: "Productivity", glyph: "↯" },
  { key: "research", label: "Research", glyph: "⌕" },
  { key: "sales", label: "Sales", glyph: "↗" },
  { key: "support", label: "Support", glyph: "☏" },
  { key: "writing", label: "Writing", glyph: "¶" },
  CUSTOM,
];

/** Old marketplace names (Title Case) -> category keys. */
const LEGACY: Readonly<Record<string, string>> = {
  "personal assistant": "general",
  "customer support": "support",
  devops: "development",
  "social media": "marketing",
  accounting: "business",
  "e-commerce": "sales",
  "content creation": "writing",
  "data analysis": "analytics",
  operations: "productivity",
};

/** agent_type -> category key, for agents with no category of their own. */
const FROM_TYPE: Readonly<Record<string, string>> = {
  assistant: "general",
  support: "support",
  devops: "development",
  data_analyst: "analytics",
  code_architect: "development",
  security_expert: "development",
  performance_optimizer: "development",
  infrastructure_manager: "development",
  researcher: "research",
  worker: "productivity",
  "document generator": "writing",
};

function byKey(key: string | undefined): AgentCategory | undefined {
  return key === undefined ? undefined : CATEGORIES.find((category) => category.key === key);
}

/** The category's glyph and word: category first, then agent_type, else Custom. */
export function agentCategory(agent: Pick<AgentSummary, "category" | "agentType">): AgentCategory {
  const raw = agent.category?.trim().toLowerCase();
  const type = agent.agentType?.trim().toLowerCase();
  return (
    byKey(raw) ??
    byKey(raw === undefined ? undefined : LEGACY[raw]) ??
    byKey(type === undefined ? undefined : FROM_TYPE[type]) ??
    CUSTOM
  );
}
