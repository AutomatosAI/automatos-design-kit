// The chat's message model: what the chat screen renders for one conversation.
// Built from stream events by lib/chat/turn.ts; never from raw lines.

import type { JsonObject, Receipt } from "@/lib/stream/types";

/** running until tool-end; stopped when the turn ended (stop, error) before it did. */
export type ToolStatus = "running" | "done" | "failed" | "skipped" | "waiting" | "stopped";

/** One tool call, from its tool-start and tool-end. */
export type ToolLine = {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly input: JsonObject;
  readonly status: ToolStatus;
  /** null while running, or when the turn ended without a tool-end. */
  readonly success: boolean | null;
  readonly durationMs: number | null;
  readonly summary: string | null;
  readonly error: string | null;
};

/** A muted line: narration (what Auto said before calling tools) or progress from inside a tool. */
export type ActivityLine = { readonly kind: "narration" | "progress"; readonly text: string };

export type TurnStatus = "streaming" | "done" | "stopped" | "failed";

export type MissionSuggestion = { readonly goal: string; readonly complexity: string | null };

export type UserMessage = { readonly id: string; readonly role: "user"; readonly text: string };

export type AutoMessage = {
  readonly id: string;
  readonly role: "assistant";
  /** The answer, as markdown. Narration is moved out of it into activity. */
  readonly text: string;
  /** The thinking channel. Never shown as the answer. */
  readonly reasoning: string;
  readonly tools: readonly ToolLine[];
  /** What Auto did this turn (the receipts event only, never the tool-data copy). */
  readonly receipts: readonly Receipt[];
  /** Lines the reply shows above its text. */
  readonly above: readonly string[];
  readonly activity: readonly ActivityLine[];
  /** Things to show in words: limits reached, withdrawn asks, a cancel that didn't reach Auto. */
  readonly notices: readonly string[];
  /** Friendly error sentences (the console has the detail). */
  readonly errors: readonly string[];
  readonly missionSuggestion: MissionSuggestion | null;
  readonly status: TurnStatus;
};

export type ChatMessage = UserMessage | AutoMessage;
