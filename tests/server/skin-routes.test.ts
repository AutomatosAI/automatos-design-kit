// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as importSkin } from "@/app/api/studio/import-skin/route";
import { POST as submitSkin } from "@/app/api/studio/submit-skin/route";
import { BACKEND_IMPORT_PATH, SKIN_TIMEOUT_MS, forwardSkin } from "@/lib/server/skin-forward";
import { MAX_SKIN_BODY_BYTES, NO_SKINS_MESSAGE, SKIN_KIT_HEADER } from "@/lib/skins/sharing";

// PRD-004 K-007: Load into my Automatos and Submit to the Marketplace. Both routes need
// X-Skin-Kit: 1 (a custom header forces a preflight another site can't pass), keep the Host and
// Sec-Fetch-Site checks, refuse over the cap before reading a byte, stream the raw multipart body
// through unparsed, and turn the backend's 404 into a sentence.

const BOUNDARY = "----SkinKitBoundary4fT9wQ";
const MULTIPART = `multipart/form-data; boundary=${BOUNDARY}`;
const ZIP_BYTES = [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0xff, 0x00, 0x80, 0xfe];
const BODY = Uint8Array.from([
  ...new TextEncoder().encode(
    [
      `--${BOUNDARY}`,
      'Content-Disposition: form-data; name="file"; filename="warm-paper-1.0.0.autoskin"',
      "Content-Type: application/zip",
      "",
      "",
    ].join("\r\n"),
  ),
  ...ZIP_BYTES,
  ...new TextEncoder().encode(`\r\n--${BOUNDARY}--\r\n`),
]);

const fetchMock = vi.fn<typeof fetch>();

type SendOptions = { headers?: Record<string, string>; body?: Uint8Array<ArrayBuffer>; host?: string };

function skinRequest(route: string, { headers = {}, body = BODY, host = "localhost:3100" }: SendOptions = {}): Request {
  return new Request(`http://${host}${route}`, {
    method: "POST",
    headers: {
      "Content-Type": MULTIPART,
      "Content-Length": String(body.byteLength),
      [SKIN_KIT_HEADER]: "1",
      ...headers,
    },
    body,
  });
}

const importRequest = (options?: SendOptions) => skinRequest("/api/studio/import-skin", options);

function forwarded(): { url: string; init: RequestInit & { duplex?: string } } {
  const call = fetchMock.mock.calls[0];
  if (!call) throw new Error("the skin was not forwarded");
  return { url: String(call[0]), init: call[1] ?? {} };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("AUTOMATOS_BACKEND_URL", "");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  fetchMock.mockImplementation(async () => Response.json({ id: "skin-1", name: "Warm Paper", status: "approved" }));
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the skin routes: refusals", () => {
  it("refuses a request without X-Skin-Kit: 1, before any call", async () => {
    const without = await importSkin(importRequest({ headers: { [SKIN_KIT_HEADER]: "" } }));
    const wrong = await importSkin(importRequest({ headers: { [SKIN_KIT_HEADER]: "yes" } }));
    const submit = await submitSkin(skinRequest("/api/studio/submit-skin", { headers: { [SKIN_KIT_HEADER]: "" } }));

    expect([without.status, wrong.status, submit.status]).toEqual([403, 403, 403]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the Host and Sec-Fetch-Site checks", async () => {
    const rebound = await importSkin(importRequest({ host: "attacker.example:3100" }));
    const crossSite = await importSkin(importRequest({ headers: { "Sec-Fetch-Site": "cross-site" } }));

    expect([rebound.status, crossSite.status]).toEqual([403, 403]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses over the cap from the declared length, without reading the body", async () => {
    const request = importRequest({ headers: { "Content-Length": String(MAX_SKIN_BODY_BYTES + 1) } });

    const response = await importSkin(request);

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: expect.stringContaining("15 MB") });
    expect(request.bodyUsed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a body with no length (411) or that isn't multipart with a boundary (415)", async () => {
    const noLength = await importSkin(importRequest({ headers: { "Content-Length": "lots" } }));
    const json = await importSkin(importRequest({ headers: { "Content-Type": "application/json" } }));
    const noBoundary = await importSkin(importRequest({ headers: { "Content-Type": "multipart/form-data" } }));

    expect([noLength.status, json.status, noBoundary.status]).toEqual([411, 415, 415]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the skin routes: streaming through", () => {
  it("forwards the import's bytes unchanged, with the original boundary, as a half-duplex stream", async () => {
    const response = await importSkin(importRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({ name: "Warm Paper" }));
    const { url, init } = forwarded();
    expect(url).toBe("http://localhost:8000/api/skins/import");
    expect(init.method).toBe("POST");
    expect(init.duplex).toBe("half");
    expect(init.body).toBeInstanceOf(ReadableStream);
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe(MULTIPART);
    expect(headers.get(SKIN_KIT_HEADER)).toBeNull();
    expect(headers.get("Authorization")).toBeNull();
    expect(new Uint8Array(await new Response(init.body).arrayBuffer())).toEqual(BODY);
  });

  it("sends a submission to the Marketplace route the same way", async () => {
    const response = await submitSkin(skinRequest("/api/studio/submit-skin"));

    expect(response.status).toBe(200);
    const { url, init } = forwarded();
    expect(url).toBe("http://localhost:8000/api/marketplace/skins");
    expect(new Uint8Array(await new Response(init.body).arrayBuffer())).toEqual(BODY);
  });

  it("says the Automatos doesn't support skins yet when the backend answers 404", async () => {
    fetchMock.mockImplementation(async () => Response.json({ detail: "Not Found" }, { status: 404 }));

    const imported = await importSkin(importRequest());
    const submitted = await submitSkin(skinRequest("/api/studio/submit-skin"));

    expect(imported.status).toBe(404);
    expect(await imported.json()).toEqual({ error: NO_SKINS_MESSAGE });
    expect(await submitted.json()).toEqual({ error: NO_SKINS_MESSAGE });
  });

  it("passes the validator's refusal back as it came, with the safety headers", async () => {
    const refusal = { detail: { errors: [{ code: "CONTRAST", path: "$.tokens.light.primary-foreground", message: "Too faint." }] } };
    fetchMock.mockImplementation(async () => Response.json(refusal, { status: 400 }));

    const response = await importSkin(importRequest());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(refusal);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("waits a long time, then says Automatos took too long", async () => {
    expect(SKIN_TIMEOUT_MS).toBe(2 * 60 * 1000);
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) return;
          signal.addEventListener("abort", () => reject(signal.reason));
        }),
    );

    const response = await forwardSkin(importRequest(), BACKEND_IMPORT_PATH, 20);

    expect(response.status).toBe(504);
  });

  it("says Automatos isn't running when the backend can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const response = await importSkin(importRequest());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Automatos isn't running at http://localhost:8000" });
  });
});
