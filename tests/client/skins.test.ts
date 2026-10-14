// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KIT_UNREACHABLE, acceptedMessage, refusalReasons, sendSkin } from "@/lib/client/skins";
import { DEFAULT_STUDIO_URL, NO_SKINS_MESSAGE, SKIN_KIT_HEADER, studioMarketplaceUrl } from "@/lib/skins/sharing";

// PRD-004 K-007: the browser's one call for skins. It posts the packed file as a multipart form
// to the kit's own route with X-Skin-Kit: 1, never to the backend, and turns any answer into
// sentences.

const fetchMock = vi.fn<typeof fetch>();
const SKIN = { bytes: Uint8Array.from([0x50, 0x4b, 0x05, 0x06]), fileName: "warm-paper-1.0.0.autoskin", name: "Warm Paper" };

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sendSkin", () => {
  it("posts the file as the form's `file` field to the kit's import route, with X-Skin-Kit: 1", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: "s1", name: "Warm Paper" }));

    const result = await sendSkin("import", SKIN);

    expect(result).toEqual({ ok: true, message: "Warm Paper is in your Automatos. Pick it in Studio under Style, Skins." });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/studio/import-skin");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get(SKIN_KIT_HEADER)).toBe("1");
    expect(new Headers(init?.headers).get("Authorization")).toBeNull();
    const body = init?.body;
    expect(body).toBeInstanceOf(FormData);
    const file = body instanceof FormData ? body.get("file") : null;
    expect(file instanceof File && file.name).toBe(SKIN.fileName);
    expect(file instanceof File && new Uint8Array(await file.arrayBuffer())).toEqual(SKIN.bytes);
  });

  it("sends a submission to the submit route and reads its review status", async () => {
    fetchMock.mockResolvedValue(Response.json({ name: "Warm Paper", status: "pending" }));

    const result = await sendSkin("submit", SKIN);

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/studio/submit-skin");
    expect(result).toEqual({ ok: true, message: "Warm Paper was sent to the Marketplace. It shows there once it has been reviewed." });
  });

  it("gives the 404 sentence when the Automatos has no skins", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: NO_SKINS_MESSAGE }, { status: 404 }));

    expect(await sendSkin("import", SKIN)).toEqual({ ok: false, message: "Your Automatos didn't load the skin.", reasons: [NO_SKINS_MESSAGE] });
  });

  it("lists the validator's reasons, or the status when there are none", async () => {
    const refusal = { detail: { code: "INVALID", errors: [{ path: "$.tokens.light.ring", message: "Too faint." }] } };
    fetchMock.mockResolvedValueOnce(Response.json(refusal, { status: 400 }));
    fetchMock.mockResolvedValueOnce(new Response("<html>oops</html>", { status: 500 }));

    expect(await sendSkin("submit", SKIN)).toEqual({
      ok: false,
      message: "The Marketplace didn't take the skin.",
      reasons: ["$.tokens.light.ring: Too faint."],
    });
    expect(await sendSkin("import", SKIN)).toEqual({ ok: false, message: "Your Automatos didn't load the skin.", reasons: ["Automatos answered HTTP 500."] });
  });

  it("says the kit's server didn't answer when the request fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    expect(await sendSkin("import", SKIN)).toEqual({ ok: false, message: KIT_UNREACHABLE, reasons: [] });
  });
});

describe("reading answers", () => {
  it("reads every refusal shape as plain lines", () => {
    expect(refusalReasons({ detail: "Package too large" })).toEqual(["Package too large"]);
    expect(refusalReasons({ detail: [{ loc: ["body", "file"], msg: "Field required" }] })).toEqual(["Field required"]);
    expect(refusalReasons({ errors: [{ path: "$", message: "Not a zip." }, 42, null] })).toEqual(["Not a zip."]);
    expect(refusalReasons("nope")).toEqual([]);
    expect(refusalReasons({ error: "x".repeat(400) })[0]).toHaveLength(301);
  });

  it("says a trusted author's skin is published at once", () => {
    expect(acceptedMessage("submit", { status: "approved", skin: { name: "Neon" } }, "Fallback")).toBe("Neon is on the Marketplace now.");
    expect(acceptedMessage("import", null, "Fallback")).toMatch(/^Fallback is in your Automatos/);
  });
});

describe("studioMarketplaceUrl", () => {
  it("is Studio's Marketplace page, from the setting or the local default", () => {
    expect(studioMarketplaceUrl(undefined)).toBe(`${DEFAULT_STUDIO_URL}/marketplace`);
    expect(studioMarketplaceUrl(" http://studio.lan:3000/ ")).toBe("http://studio.lan:3000/marketplace");
  });

  it("falls back to the default for anything that isn't a plain http(s) URL", () => {
    for (const bad of ["javascript:alert(1)", "http://user:pw@host", "ftp://host", "http://host/?q=1", "//host"]) {
      expect(studioMarketplaceUrl(bad)).toBe(`${DEFAULT_STUDIO_URL}/marketplace`);
    }
  });
});
