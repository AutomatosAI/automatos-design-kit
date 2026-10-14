import { isRecord, parseWorkspace, type Workspace } from "@/lib/client/types";

// How lib/client reaches Play's own /api/* routes (never the backend). It fetches the
// workspace once, keeps it in memory, and sends its id as X-Workspace-ID on every
// other request. The endpoint groups (lib/client/api.ts, lib/client/missions.ts) sit on it.

export const WORKSPACE_HEADER = "X-Workspace-ID";
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
export function errorMessage(body: unknown, status: number): string {
  if (isRecord(body)) {
    if (typeof body.error === "string") return body.error;
    if (typeof body.detail === "string") return body.detail;
  }
  return `Automatos answered with an error (${status})`;
}

export async function failure(response: Response, path: string): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  const error = new ApiError(response.status, errorMessage(body, response.status));
  console.error(`[api] ${path} failed with ${response.status}:`, body);
  return error;
}

export type Transport = {
  readonly getWorkspace: () => Promise<Workspace>;
  /** A request to one of our routes, with X-Workspace-ID (and a JSON Content-Type on anything but GET). */
  readonly call: (path: string, init?: RequestInit) => Promise<Response>;
  /** call, then the JSON body; a non-2xx answer throws an ApiError. */
  readonly callJson: (path: string, init?: RequestInit) => Promise<unknown>;
};

export function createTransport(fetchImpl: Fetch): Transport {
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
