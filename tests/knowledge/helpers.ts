import { vi } from "vitest";

import { createApiClient, type Fetch } from "@/lib/client/api";
import type { UploadReply, UploadRequest, UploadSender } from "@/lib/client/upload";

// Knowledge test helpers: backend-shaped rows, a fetch that answers Play's /api/documents
// routes, and an upload sender that records what the page sent.

export const WORKSPACE = { id: "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10", name: "Home" };

export type Row = Readonly<Record<string, unknown>>;

export function documentRow(id: number, overrides: Row = {}): Row {
  return {
    id,
    filename: `notes-${id}.md`,
    original_filename: `notes-${id}.md`,
    file_type: "markdown",
    file_size: 2048,
    status: "processed",
    chunk_count: 4,
    tags: [],
    description: null,
    upload_date: "2026-10-14T09:00:00",
    processed_date: "2026-10-14T09:01:00",
    ...overrides,
  };
}

export interface DocumentRoutes {
  readonly list?: () => Response;
  /** GET /api/documents/<id>, asked in turn: the last answer repeats. */
  readonly documents?: Readonly<Record<number, readonly Row[]>>;
  readonly content?: (id: number) => Response;
  readonly impact?: () => Response;
  readonly remove?: () => Response;
  readonly search?: (body: unknown) => Response | Promise<Response>;
}

/** The fetch mock and, per document id, how often GET /api/documents/<id> was asked. */
export function mockDocumentsFetch(routes: DocumentRoutes = {}) {
  const asked = new Map<number, number>();
  const fetch = vi.fn<Fetch>(async (input, init) => {
    if (input === "/api/workspace") return Response.json(WORKSPACE);
    const url = new URL(input, "http://play.test");
    const method = init?.method ?? "GET";
    if (url.pathname === "/api/documents") return routes.list ? routes.list() : Response.json([]);
    if (url.pathname === "/api/documents/search") return answerSearch(routes, init);
    const match = /^\/api\/documents\/(\d+)(\/[\w-]+)?$/.exec(url.pathname);
    if (!match) return Response.json({ detail: "Not found" }, { status: 404 });
    const id = Number(match[1]);
    const suffix = match[2] ?? "";
    if (suffix === "/content") return routes.content ? routes.content(id) : Response.json({ content: "" });
    if (suffix === "/delete-impact") return routes.impact ? routes.impact() : Response.json({});
    if (method === "DELETE") return routes.remove ? routes.remove() : Response.json({ message: "deleted" });
    const turn = asked.get(id) ?? 0;
    asked.set(id, turn + 1);
    const answers = routes.documents?.[id] ?? [];
    const row = answers[Math.min(turn, answers.length - 1)];
    return row ? Response.json(row) : Response.json({ detail: "Document not found" }, { status: 404 });
  });
  return { fetch, asked };
}

async function answerSearch(routes: DocumentRoutes, init: RequestInit | undefined): Promise<Response> {
  const body: unknown = JSON.parse(String(init?.body ?? "{}"));
  return routes.search ? routes.search(body) : Response.json({ query: "", results: [] });
}

/** Calls to one path (any query), in order. */
export function callsTo(fetch: ReturnType<typeof mockDocumentsFetch>["fetch"], path: string) {
  return fetch.mock.calls.filter(([input]) => new URL(input, "http://play.test").pathname === path);
}

/** An upload sender that records each request and answers with reply (or waits for it). */
export function mockUploadSender(reply: (request: UploadRequest) => UploadReply | Promise<UploadReply>) {
  return vi.fn<UploadSender>(async (request) => reply(request));
}

export function documentsClient(fetch: Fetch, sender: UploadSender = mockUploadSender(() => ({ status: 500, body: null }))) {
  return createApiClient(fetch, sender);
}

/** A file of the given name; size overridden when a test needs a big one without the bytes. */
export function fileNamed(name: string, size?: number, text = "# Notes\n\nHello."): File {
  const file = new File([text], name, { type: "" });
  if (size !== undefined) Object.defineProperty(file, "size", { value: size });
  return file;
}

/** A promise the test settles by hand. */
export function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}
