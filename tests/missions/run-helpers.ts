// A mocked fetch for the Mission run page. GET /api/missions/<id> answers the details in
// turn (staying on the last), so a test can move a Mission through its states one poll at
// a time. Agents, cost, events and the Mission's Deliverables answer synthetic test data;
// every action answers 200 unless the test gives its own answer.

import { vi } from "vitest";

import type { Fetch } from "@/lib/client/api";

import { WORKSPACE } from "../chat/helpers";

export type Json = Readonly<Record<string, unknown>>;

const BASE = "http://play.test";
const DETAIL = /^\/api\/missions\/([^/]+)$/;

export const AGENTS = [
  { id: 1, name: "Auto", slug: "auto", status: "active", is_system_agent: true },
  { id: 7, name: "Researcher Rae", slug: "rae", status: "active", is_system_agent: false },
  { id: 9, name: "Writer Wren", slug: "wren", status: "active", is_system_agent: false },
];

export function cost(id: string): Json {
  return { mission_id: id, total_tokens: 5400, estimated_cost: 0.0162, cost_per_1k_tokens: 0.003, tasks: [] };
}

export function deliverableRow(id: string, missionId: string): Json {
  return {
    id,
    title: "Spring launch plan",
    artifact_type: "report",
    source_type: "mission",
    source_id: missionId,
    file_type: "md",
    preview_url: null,
    created_at: "2026-10-14T10:00:00+00:00",
  };
}

export function event(id: string, eventType: string, createdAt: string, extra: Json = {}): Json {
  return { id, event_type: eventType, actor_type: "system", created_at: createdAt, ...extra };
}

/** method path, e.g. "POST /api/missions/m-run/cancel" -> a Response. */
export type Routes = Readonly<Record<string, (init?: RequestInit) => Response>>;

export interface RunFetchOptions {
  readonly routes?: Routes;
  readonly deliverables?: readonly Json[];
  readonly events?: (params: URLSearchParams) => Json;
}

export function mockRunFetch(details: readonly Json[], options: RunFetchOptions = {}) {
  let served = 0;
  return vi.fn<Fetch>(async (input, init) => {
    const url = new URL(input, BASE);
    const method = init?.method ?? "GET";
    const own = options.routes?.[`${method} ${url.pathname}`];
    if (own) return own(init);
    if (url.pathname === "/api/workspace") return Response.json(WORKSPACE);
    if (url.pathname === "/api/agents") return Response.json(AGENTS);
    if (url.pathname === "/api/deliverables") {
      const rows = options.deliverables ?? [];
      return Response.json({ success: true, deliverables: rows, total: rows.length, limit: 24, offset: 0 });
    }
    if (url.pathname.endsWith("/thumbnail")) return Response.json({ detail: "Preview not found" }, { status: 404 });
    if (url.pathname.endsWith("/cost")) return Response.json(cost(url.pathname.split("/")[3] ?? ""));
    if (url.pathname.endsWith("/events")) {
      return Response.json(options.events?.(url.searchParams) ?? { events: [], total: 0, limit: 50, offset: 0 });
    }
    if (method === "GET" && DETAIL.test(url.pathname)) {
      const detail = details[Math.min(served, details.length - 1)];
      served += 1;
      return Response.json(detail);
    }
    if (method === "DELETE") return new Response(null, { status: 204 });
    if (method !== "GET") return Response.json({});
    throw new Error(`unexpected call to ${method} ${input}`);
  });
}

type RunFetch = ReturnType<typeof mockRunFetch>;

/** Every call as "METHOD /path?query", in order. */
export function calls(fetchMock: RunFetch): readonly string[] {
  return fetchMock.mock.calls.map(([input, init]) => `${init?.method ?? "GET"} ${input}`);
}

export function detailCalls(fetchMock: RunFetch, id: string): number {
  return calls(fetchMock).filter((call) => call === `GET /api/missions/${id}`).length;
}

/** The JSON body sent with the first call matching "METHOD /path". */
export function bodyOf(fetchMock: RunFetch, call: string): unknown {
  const found = fetchMock.mock.calls.find(([input, init]) => `${init?.method ?? "GET"} ${input}` === call);
  const body = found?.[1]?.body;
  return typeof body === "string" ? JSON.parse(body) : undefined;
}
