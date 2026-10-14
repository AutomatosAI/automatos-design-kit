// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  backendUnreachable,
  DEFAULT_BACKEND_URL,
  getBackendUrl,
  readJsonObject,
  rejectCrossSite,
  workspaceHeader,
} from "@/lib/server/backend";

function post(body: string, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3100/api/x", { method: "POST", headers, body });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getBackendUrl", () => {
  it("defaults to http://localhost:8000", () => {
    vi.stubEnv("AUTOMATOS_BACKEND_URL", "");
    expect(getBackendUrl()).toBe(DEFAULT_BACKEND_URL);
    expect(DEFAULT_BACKEND_URL).toBe("http://localhost:8000");
  });

  it("reads AUTOMATOS_BACKEND_URL and drops trailing slashes", () => {
    vi.stubEnv("AUTOMATOS_BACKEND_URL", " http://backend:8000// ");
    expect(getBackendUrl()).toBe("http://backend:8000");
  });

  it("throws on a value that is not an http(s) URL", () => {
    vi.stubEnv("AUTOMATOS_BACKEND_URL", "localhost:8000");
    expect(() => getBackendUrl()).toThrow(/AUTOMATOS_BACKEND_URL/);
  });

  it("throws on a URL carrying a user or password", () => {
    vi.stubEnv("AUTOMATOS_BACKEND_URL", "http://admin:secret@backend:8000");
    expect(() => getBackendUrl()).toThrow(/no user or password/);
  });
});

describe("backendUnreachable", () => {
  it("is a 502 naming the backend URL", async () => {
    const response = backendUnreachable("http://localhost:8000");
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Automatos isn't running at http://localhost:8000" });
  });
});

describe("rejectCrossSite", () => {
  const json = { "Content-Type": "application/json" };

  it("lets same-origin JSON, bodyless JSON and GET requests through", () => {
    expect(rejectCrossSite(post("{}", { ...json, "Sec-Fetch-Site": "same-origin" }))).toBeNull();
    expect(rejectCrossSite(post("{}", json))).toBeNull();
    expect(rejectCrossSite(new Request("http://localhost:3100/api/x", { method: "POST", headers: json }))).toBeNull();
    expect(rejectCrossSite(new Request("http://localhost:3100/api/x"))).toBeNull();
  });

  it("refuses a bodyless change not typed as JSON (a cross-site POST needs no preflight)", () => {
    expect(rejectCrossSite(new Request("http://localhost:3100/api/x", { method: "POST" }))?.status).toBe(415);
    expect(rejectCrossSite(new Request("http://localhost:3100/api/x", { method: "DELETE" }))?.status).toBe(415);
  });

  it("refuses a request another site started", () => {
    expect(rejectCrossSite(post("{}", { ...json, "Sec-Fetch-Site": "cross-site" }))?.status).toBe(403);
    expect(rejectCrossSite(post("{}", { ...json, "Sec-Fetch-Site": "same-site" }))?.status).toBe(403);
  });

  it("refuses a Host that is not local (DNS rebinding) unless PLAY_ALLOWED_HOSTS lists it", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rebound = new Request("http://attacker.example:3100/api/x", { method: "GET" });
    expect(rejectCrossSite(rebound)?.status).toBe(403);

    vi.stubEnv("PLAY_ALLOWED_HOSTS", "play.lan, other.lan");
    expect(rejectCrossSite(new Request("http://play.lan:3100/api/x"))).toBeNull();
    expect(rejectCrossSite(new Request("http://127.0.0.1:3100/api/x"))).toBeNull();
    expect(rejectCrossSite(new Request("http://[::1]:3100/api/x"))).toBeNull();
  });

  it("refuses a body that is not sent as JSON (a form or text/plain post)", () => {
    expect(rejectCrossSite(post("{}", { "Content-Type": "text/plain" }))?.status).toBe(415);
  });
});

describe("workspaceHeader", () => {
  it("forwards a well-formed id and allows none", () => {
    expect(workspaceHeader(post("{}", { "X-Workspace-ID": "ws-1" }))).toEqual({
      ok: true,
      headers: { "X-Workspace-ID": "ws-1" },
    });
    expect(workspaceHeader(post("{}"))).toEqual({ ok: true, headers: {} });
  });

  it("rejects an id with path or header characters", () => {
    expect(workspaceHeader(post("{}", { "X-Workspace-ID": "a/b" }))).toEqual({ ok: false });
  });
});

describe("readJsonObject", () => {
  it("accepts a JSON object and rejects everything else", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await readJsonObject(post('{"a":1}'))).toEqual({ ok: true, value: { a: 1 } });
    expect(await readJsonObject(post("[1]"))).toEqual({ ok: false });
    expect(await readJsonObject(post('"text"'))).toEqual({ ok: false });
    expect(await readJsonObject(post("{oops"))).toEqual({ ok: false });
  });
});
