// A mocked fetch for the shelf: /api/workspace answers a workspace, /api/deliverables
// answers through list(params), and every thumbnail is the backend's 404 unless the
// test passes its own. Rows are shaped like services/deliverable_service.py's list.

import { vi } from "vitest";

import type { Fetch } from "@/lib/client/api";

import { WORKSPACE } from "../chat/helpers";

export type Row = Readonly<Record<string, unknown>>;

export function row(id: string, fields: Row = {}): Row {
  return {
    id,
    title: `Deliverable ${id}`,
    summary: null,
    artifact_type: "document",
    source_type: "chat",
    source_id: null,
    agent_id: null,
    file_path: `outputs/${id}.md`,
    preview_url: null,
    created_at: "2026-10-01T09:00:00+00:00",
    ...fields,
  };
}

export function listBody(rows: readonly Row[], total = rows.length, offset = 0) {
  return { success: true, deliverables: rows, total, limit: 24, offset };
}

const THUMBNAIL = /^\/api\/deliverables\/([^/]+)\/thumbnail$/;
const BASE = "http://play.test";

export function mockShelfFetch(
  list: (params: URLSearchParams) => Response,
  thumbnail: (id: string) => Response = () => Response.json({ detail: "Preview not found" }, { status: 404 }),
) {
  return vi.fn<Fetch>(async (input) => {
    const url = new URL(input, BASE);
    if (url.pathname === "/api/workspace") return Response.json(WORKSPACE);
    if (url.pathname === "/api/deliverables") return list(url.searchParams);
    const match = THUMBNAIL.exec(url.pathname);
    if (match) return thumbnail(decodeURIComponent(match[1] ?? ""));
    throw new Error(`unexpected call to ${input}`);
  });
}

/** The query string of every list request, in order. */
export function listCalls(fetchMock: ReturnType<typeof mockShelfFetch>): readonly URLSearchParams[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(input, BASE))
    .filter((url) => url.pathname === "/api/deliverables")
    .map((url) => url.searchParams);
}
