// The typed events of one chat turn, parsed from the backend's line stream.
// Spec: skills/build-automatos-interface/references/chat-stream.md. The chat and
// the mascot both read these; nothing else reads the raw lines.

export type JsonObject = Readonly<Record<string, unknown>>;

export type ReceiptStatus = "done" | "refused" | "skipped" | "waiting";

/** One thing Auto did this turn (consumers/chatbot/receipts.py). */
export type Receipt = {
  readonly action: string;
  readonly kind: string;
  readonly status: ReceiptStatus;
  readonly subject: string;
  readonly effect: string;
  readonly link: string | null;
  readonly reason: string | null;
};

export type AgentInfo = {
  readonly id: number | null;
  readonly name: string;
  readonly agentType: string | null;
  readonly skills: readonly string[];
  readonly isCto: boolean;
};

export type TextEvent = { readonly type: "text"; readonly text: string };
export type ChatIdEvent = { readonly type: "chat-id"; readonly chatId: string };
export type AgentInfoEvent = { readonly type: "agent-info"; readonly agent: AgentInfo };
export type AgentAssignedEvent = {
  readonly type: "agent-assigned";
  readonly agentId: number | null;
  readonly agentName: string;
  readonly routeMethod: string | null;
};
export type ReasoningEvent = { readonly type: "reasoning"; readonly delta: string };
export type ProgressEvent = { readonly type: "progress"; readonly text: string };
export type NarrationEvent = {
  readonly type: "narration";
  readonly text: string;
  readonly retracted: boolean;
};
export type ToolStartEvent = {
  readonly type: "tool-start";
  readonly toolCallId: string;
  readonly toolName: string;
  readonly input: JsonObject;
};
export type ToolEndEvent = {
  readonly type: "tool-end";
  readonly toolCallId: string;
  readonly toolName: string;
  readonly success: boolean;
  readonly error: string | null;
  readonly durationMs: number | null;
  readonly summary: string | null;
  readonly skipped: boolean;
  /** An ask: Auto waits for the owner. success is false, but it is not a failure. */
  readonly waiting: boolean;
};
/** The tool's result payload. The backend also sends the turn's receipts here (key "receipts"). */
export type ToolDataEvent = { readonly type: "tool-data"; readonly data: JsonObject };
export type ReceiptsEvent = {
  readonly type: "receipts";
  readonly receipts: readonly Receipt[];
  readonly model: string | null;
  /** Lines the reply shows above its text ("Just to be clear: I haven't done that yet…"). */
  readonly above: readonly string[];
};
export type MissionSuggestionEvent = {
  readonly type: "mission-suggestion";
  readonly goal: string;
  readonly complexity: string | null;
  readonly agentId: number | null;
};
export type WorkflowUpdateEvent = {
  readonly type: "workflow-update";
  readonly workflowId: string;
  readonly status: string;
  readonly currentStep: string | null;
  readonly progress: number | null;
};
export type MemoryInjectedEvent = {
  readonly type: "memory-injected";
  readonly memories: readonly unknown[];
  readonly totalMatched: number;
};
export type MemoryStoredEvent = {
  readonly type: "memory-stored";
  readonly memory: JsonObject;
  readonly reason: string | null;
};
export type LimitReachedEvent = {
  readonly type: "limit_reached";
  readonly limit: string;
  readonly value: number;
  readonly message: string;
};
export type ToolPermissionDeniedEvent = {
  readonly type: "tool-permission-denied";
  readonly toolName: string;
  readonly agentId: number | null;
  readonly reason: string | null;
};
export type AttachmentUnavailableEvent = {
  readonly type: "attachment_unavailable";
  readonly attachments: readonly unknown[];
};
export type WithdrawOfferEvent = {
  readonly type: "withdraw_offer";
  readonly message: string;
  readonly requests: readonly unknown[];
};
export type BudgetWarningEvent = {
  readonly type: "budget-warning";
  readonly tokensUsed: number;
  readonly tokenBudget: number;
  readonly percentUsed: number;
};
export type UsageEvent = {
  readonly type: "usage";
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
};
export type FinishEvent = { readonly type: "finish"; readonly finishReason: string | null };
/** An e: line, or a legacy data: {type:"error"} frame. */
export type ErrorEvent = { readonly type: "error"; readonly message: string; readonly code: string | null };
/** A d: or data: type this version doesn't know. Normal: the backend adds new ones. */
export type UnknownEvent = { readonly type: "unknown"; readonly eventType: string };

export type StreamEvent =
  | TextEvent
  | ChatIdEvent
  | AgentInfoEvent
  | AgentAssignedEvent
  | ReasoningEvent
  | ProgressEvent
  | NarrationEvent
  | ToolStartEvent
  | ToolEndEvent
  | ToolDataEvent
  | ReceiptsEvent
  | MissionSuggestionEvent
  | WorkflowUpdateEvent
  | MemoryInjectedEvent
  | MemoryStoredEvent
  | LimitReachedEvent
  | ToolPermissionDeniedEvent
  | AttachmentUnavailableEvent
  | WithdrawOfferEvent
  | BudgetWarningEvent
  | UsageEvent
  | FinishEvent
  | ErrorEvent
  | UnknownEvent;

export type StreamEventType = StreamEvent["type"];
