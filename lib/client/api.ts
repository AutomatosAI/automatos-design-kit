import {
  isRecord,
  parseChatSummaries,
  parseDeliverable,
  parseDeliverableList,
  parseStoredMessages,
  parseWorkspace,
  type ChatSummary,
  type ChatTurnRequest,
  type Deliverable,
  type DeliverableList,
  type DeliverableQuery,
  type StoredMessage,
  type Workspace,
} from "@/lib/client/types";

// The only place the browser calls Play's own /api/* routes (never the backend).
// It fetches the workspace once, keeps it in memory, and sends its id as
// X-Workspace-ID on every other request.

const WORKSPACE_HEADER = "X-Workspace-ID";
const DEFAULT_HISTORY_LIMIT = 20;
const DEFAULT_EXCLUDED_SOURCES = "heartbeat";
const UNREACHABLE = 0;

/** A request that failed. status 502 means Automatos isn't running; 0 means Play's own server didn't answer. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** fetch as this client uses it; tests pass a mock. */
export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Our proxy says {error}; FastAPI says {detail}, a string or a validation list. */
function errorMessage(body: unknown, status: number): string {
  if (isRecord(body)) {
    if (typeof body.error === "string") return body.error;
    if (typeof body.detail === "string") return body.detail;
  }
  return `Automatos answered with an error (${status})`;
}

async function failure(response: Response, path: string): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  const error = new ApiError(response.status, errorMessage(body, response.status));
  console.error(`[api] ${path} failed with ${response.status}:`, body);
  return error;
}

function deliverablesSearch(query: DeliverableQuery): string {
  const params = new URLSearchParams({
    source_type_exclude: query.sourceTypeExclude ?? DEFAULT_EXCLUDED_SOURCES,
  });
  if (query.artifactType) params.set("artifact_type", query.artifactType);
  if (query.search) params.set("search", query.search);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  return params.toString();
}

type Transport = {
  readonly getWorkspace: () => Promise<Workspace>;
  /** A request to one of our routes, with X-Workspace-ID (and a JSON Content-Type on anything but GET). */
  readonly call: (path: string, init?: RequestInit) => Promise<Response>;
  /** call, then the JSON body; a non-2xx answer throws an ApiError. */
  readonly callJson: (path: string, init?: RequestInit) => Promise<unknown>;
};

function createTransport(fetchImpl: Fetch): Transport {
  let workspace: Promise<Workspace> | null = null;

  async function send(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await fetchImpl(path, { cache: "no-store", ...init });
    } catch (error) {
      if (init.signal?.aborted) throw error;
      console.error(`[api] ${path} did not answer:`, error);
      throw new ApiError(UNREACHABLE, "Play couldn't reach its own server. Is it still running?");
    }
  }

  async function loadWorkspace(): Promise<Workspace> {
    const response = await send("/api/workspace");
    if (!response.ok) throw await failure(response, "/api/workspace");
    const parsed = parseWorkspace(await response.json());
    if (!parsed) throw new ApiError(response.status, "Automatos didn't say which workspace to use");
    return parsed;
  }

  /** Fetched once; a failure is not cached, so "Check again" can retry. */
  function getWorkspace(): Promise<Workspace> {
    if (!workspace) {
      workspace = loadWorkspace().catch((error: unknown) => {
        workspace = null;
        throw error;
      });
    }
    return workspace;
  }

  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    const { id } = await getWorkspace();
    // Next can hand a route a non-null body even for a bodyless POST, and the
    // proxy's CSRF guard refuses a body not typed as JSON.
    const isGet = (init.method ?? "GET") === "GET";
    const headers = { ...(isGet ? {} : { "Content-Type": "application/json" }), [WORKSPACE_HEADER]: id };
    return send(path, { ...init, headers });
  }

  async function callJson(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await call(path, init);
    if (!response.ok) throw await failure(response, path);
    return response.json();
  }

  return { getWorkspace, call, callJson };
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
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** The app's one client. Tests build their own with createApiClient(mockFetch). */
export const api: ApiClient = createApiClient();
