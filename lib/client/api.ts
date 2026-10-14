import { agentEndpoints } from "@/lib/client/agents";
import { missionEndpoints } from "@/lib/client/missions";
import { ApiError, createTransport, failure, type Fetch, type Transport } from "@/lib/client/transport";
import {
  isRecord,
  parseChatSummaries,
  parseDeliverable,
  parseDeliverableList,
  parseStoredMessages,
  type ChatSummary,
  type ChatTurnRequest,
  type Deliverable,
  type DeliverableList,
  type DeliverableQuery,
  type StoredMessage,
} from "@/lib/client/types";

// The browser's one client for Play's own /api/* routes (never the backend). The
// transport (workspace header, errors) is lib/client/transport.ts.

export { ApiError, type Fetch };

const DEFAULT_HISTORY_LIMIT = 20;
const DEFAULT_EXCLUDED_SOURCES = "heartbeat";

function deliverablesSearch(query: DeliverableQuery): string {
  const params = new URLSearchParams({
    source_type_exclude: query.sourceTypeExclude ?? DEFAULT_EXCLUDED_SOURCES,
  });
  if (query.artifactType) params.set("artifact_type", query.artifactType);
  if (query.sourceType) params.set("source_type", query.sourceType);
  if (query.sourceId) params.set("source_id", query.sourceId);
  if (query.search) params.set("search", query.search);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  return params.toString();
}

function chatEndpoints({ call, callJson }: Transport) {
  return {
    /** The streaming turn. The caller reads response.body with the stream parser. */
    async streamChat(request: ChatTurnRequest, signal?: AbortSignal): Promise<Response> {
      const response = await call("/api/chat", { method: "POST", body: JSON.stringify(request), signal });
      if (!response.ok) throw await failure(response, "/api/chat");
      return response;
    },

    async listChats(limit: number = DEFAULT_HISTORY_LIMIT): Promise<readonly ChatSummary[]> {
      return parseChatSummaries(await callJson(`/api/chat/history?limit=${limit}`));
    },

    async chatMessages(chatId: string): Promise<readonly StoredMessage[]> {
      return parseStoredMessages(await callJson(`/api/chat/${encodeURIComponent(chatId)}/messages`));
    },

    async cancelChat(chatId: string): Promise<boolean> {
      const body = await callJson(`/api/chat/${encodeURIComponent(chatId)}/cancel`, { method: "POST" });
      return isRecord(body) && body.cancelled === true;
    },
  };
}

/**
 * Play's route for a Deliverable's bytes. A plain link to it (a download) carries no
 * X-Workspace-ID, so the backend picks the workspace the same way it does for
 * /api/workspace, which this client also asks without one.
 */
export function deliverableFileHref(id: string): string {
  return `/api/deliverables/${encodeURIComponent(id)}/file`;
}

function deliverableEndpoints({ call, callJson }: Transport) {
  return {
    /** success: false is returned, not thrown: the shelf shows its error state. */
    async listDeliverables(query: DeliverableQuery = {}): Promise<DeliverableList> {
      return parseDeliverableList(await callJson(`/api/deliverables?${deliverablesSearch(query)}`));
    },

    /** With its content inline (include_content=true). */
    async getDeliverable(id: string): Promise<Deliverable> {
      const body = await callJson(`/api/deliverables/${encodeURIComponent(id)}?include_content=true`);
      const parsed = parseDeliverable(isRecord(body) ? body.deliverable : null);
      if (!parsed) throw new ApiError(200, "Automatos sent a Deliverable Play can't read");
      return parsed;
    },

    /** The Deliverable's file (an image to show). 404: it has none Play can open. */
    async deliverableFile(id: string): Promise<Blob> {
      const path = deliverableFileHref(id);
      const response = await call(path);
      if (!response.ok) throw await failure(response, path);
      return response.blob();
    },

    /** The thumbnail bytes, or null when the Deliverable has none (show the type-coloured fallback). */
    async deliverableThumbnail(id: string): Promise<Blob | null> {
      const path = `/api/deliverables/${encodeURIComponent(id)}/thumbnail`;
      const response = await call(path);
      if (response.status === 404) return null;
      if (!response.ok) throw await failure(response, path);
      return response.blob();
    },
  };
}

export function createApiClient(fetchImpl: Fetch = (input, init) => fetch(input, init)) {
  const transport = createTransport(fetchImpl);
  return {
    getWorkspace: transport.getWorkspace,
    ...chatEndpoints(transport),
    ...deliverableEndpoints(transport),
    ...missionEndpoints(transport),
    ...agentEndpoints(transport),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** The app's one client. Tests build their own with createApiClient(mockFetch). */
export const api: ApiClient = createApiClient();
