// The shapes Play uses, and the parsers that turn backend JSON into them. Backend
// answers are untrusted: anything missing or of the wrong type becomes null or is
// dropped, never trusted as-is. Shapes: skills/build-automatos-interface/references.

type Json = Readonly<Record<string, unknown>>;

export type Workspace = { readonly id: string; readonly name: string };

export type ChatSummary = {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  readonly lastMessagePreview: string | null;
  readonly kind: string | null;
};

export type MessagePart = Json & { readonly type: string };

export type StoredMessage = {
  readonly id: string;
  readonly role: string;
  readonly parts: readonly MessagePart[];
  /** Who wrote it when it wasn't the turn itself, e.g. {origin: "turn_error"}; null for most messages. */
  readonly source: Json | null;
  readonly createdAt: string | null;
};

export type Deliverable = {
  readonly id: string;
  readonly title: string;
  readonly summary: string | null;
  readonly artifactType: string | null;
  readonly sourceType: string | null;
  readonly agentName: string | null;
  readonly previewUrl: string | null;
  readonly fileName: string | null;
  /** The file's extension without the dot ("md", "pdf"), as the core records it. */
  readonly fileType: string | null;
  /** What it was made from (extra.sources), as short labels: a URL's host name or a title. */
  readonly sources: readonly string[];
  readonly createdAt: string | null;
  /** Only with include_content=true; null for images and videos, or when the file can't be read. */
  readonly content: string | null;
  readonly contentTruncated: boolean;
  readonly contentError: string | null;
};

export type DeliverableList =
  | {
      readonly success: true;
      readonly deliverables: readonly Deliverable[];
      readonly total: number;
      readonly limit: number;
      readonly offset: number;
    }
  | { readonly success: false; readonly error: string };

export type DeliverableQuery = {
  readonly artifactType?: string;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
  /** Comma list. Defaults to "heartbeat" in the client. */
  readonly sourceTypeExclude?: string;
  /** What made it ("mission") and which one: a Mission's own Deliverables. */
  readonly sourceType?: string;
  readonly sourceId?: string;
};

export type ChatTurnRequest = {
  /** "" on the first message; the chat-id from the stream after that. */
  readonly id: string;
  readonly message: {
    readonly role: "user";
    readonly parts: readonly { readonly type: "text"; readonly text: string }[];
  };
  readonly selectedVisibilityType: "private";
  /** The agent who answers (an integer id); left out, Auto answers. */
  readonly agentId?: number;
  readonly context?: Json;
};

export function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Ids arrive as strings, but older rows can carry numbers. */
export function idOf(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

export function count(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function listOf<T>(value: unknown, parse: (item: unknown) => T | null): readonly T[] {
  if (!Array.isArray(value)) return [];
  return value.map(parse).filter((item): item is T => item !== null);
}

export function parseWorkspace(value: unknown): Workspace | null {
  if (!isRecord(value)) return null;
  const id = idOf(value.id);
  return id ? { id, name: text(value.name) ?? "" } : null;
}

export function parseChatSummary(value: unknown): ChatSummary | null {
  if (!isRecord(value)) return null;
  const id = idOf(value.id);
  if (!id) return null;
  return {
    id,
    title: text(value.title) ?? "",
    createdAt: text(value.createdAt),
    updatedAt: text(value.updatedAt),
    lastMessagePreview: text(value.lastMessagePreview),
    kind: text(value.kind),
  };
}

function parsePart(value: unknown): MessagePart | null {
  if (!isRecord(value)) return null;
  const type = value.type;
  return typeof type === "string" ? { ...value, type } : null;
}

export function parseStoredMessage(value: unknown): StoredMessage | null {
  if (!isRecord(value)) return null;
  const id = idOf(value.id);
  const role = text(value.role);
  if (!id || !role) return null;
  return {
    id,
    role,
    parts: listOf(value.parts, parsePart),
    source: isRecord(value.source) ? value.source : null,
    createdAt: text(value.createdAt),
  };
}

/** A source as a short label: a URL's host name, else its title, else the text itself. */
function parseSource(value: unknown): string | null {
  const raw = isRecord(value) ? (text(value.url) ?? text(value.title)) : text(value);
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  try {
    return new URL(trimmed).hostname.replace(/^www\./, "");
  } catch {
    // Not a URL after all: the text is still a readable label.
    return trimmed;
  }
}

export function parseDeliverable(value: unknown): Deliverable | null {
  if (!isRecord(value)) return null;
  const id = idOf(value.id);
  if (!id) return null;
  return {
    id,
    title: text(value.title) ?? "",
    summary: text(value.summary),
    artifactType: text(value.artifact_type),
    sourceType: text(value.source_type),
    agentName: text(value.agent_name),
    previewUrl: text(value.preview_url),
    fileName: text(value.file_name),
    fileType: text(value.file_type),
    sources: isRecord(value.extra) ? listOf(value.extra.sources, parseSource) : [],
    createdAt: text(value.created_at),
    content: text(value.content),
    contentTruncated: value.content_truncated === true,
    contentError: text(value.content_error),
  };
}

/** The list answers HTTP 200 with success: false when its query fails: keep that apart from empty. */
export function parseDeliverableList(value: unknown): DeliverableList {
  if (!isRecord(value) || value.success !== true) {
    const error = isRecord(value) ? text(value.error) : null;
    return { success: false, error: error ?? "Automatos couldn't list your Deliverables" };
  }
  const deliverables = listOf(value.deliverables, parseDeliverable);
  return {
    success: true,
    deliverables,
    total: count(value.total, deliverables.length),
    limit: count(value.limit, deliverables.length),
    offset: count(value.offset, 0),
  };
}

export function parseChatSummaries(value: unknown): readonly ChatSummary[] {
  return listOf(value, parseChatSummary);
}

export function parseStoredMessages(value: unknown): readonly StoredMessage[] {
  return listOf(value, parseStoredMessage);
}
