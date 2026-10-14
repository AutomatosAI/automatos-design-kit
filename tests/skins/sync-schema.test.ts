// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHECKOUT_SCHEMA, runSyncSchema, type SyncDeps } from "@/scripts/lib/sync-schema-cli";

// npm run sync-schema: from a running Automatos or a checkout; otherwise spec/ stays as it is.

const STUDIO_SCHEMA = { $schema: "https://json-schema.org/draft/2020-12/schema", type: "object", properties: { tokens: { type: "object" } } };
const OLD_SPEC = '{ "x-status": "draft-until-studio-publishes" }\n';
const NOW = new Date("2026-10-14T09:00:00.000Z");

let root = "";
let specPath = "";

function capture() {
  const log: string[] = [];
  const error: string[] = [];
  return { io: { log: (line: string) => log.push(line), error: (line: string) => error.push(line) }, log, error };
}

function deps(overrides: Partial<SyncDeps> = {}): SyncDeps {
  return {
    fetch: vi.fn(async () => Response.json(STUDIO_SCHEMA)),
    importModule: vi.fn(async () => ({})),
    specPath,
    now: () => NOW,
    ...overrides,
  };
}

const spec = async () => readFile(specPath, "utf8");

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "skin-sync-"));
  specPath = join(root, "automatos-skin.v1.schema.json");
  await writeFile(specPath, OLD_SPEC);
  vi.stubEnv("AUTOMATOS_BACKEND_URL", "http://studio.test:8000/");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

describe("npm run sync-schema", () => {
  it("writes Studio's schema from the running Automatos and records the source", async () => {
    const out = capture();
    const injected = deps();
    expect(await runSyncSchema([], out.io, injected)).toBe(0);
    expect(injected.fetch).toHaveBeenCalledWith("http://studio.test:8000/api/skins/schema", expect.objectContaining({ headers: { Accept: "application/json" } }));
    expect(JSON.parse(await spec())).toEqual({
      ...STUDIO_SCHEMA,
      "x-status": "published-by-studio",
      "x-source": { kind: "backend", from: "http://studio.test:8000/api/skins/schema", syncedAt: "2026-10-14T09:00:00.000Z" },
    });
    expect(out.log).toEqual([`Updated ${specPath} from http://studio.test:8000/api/skins/schema.`]);
  });

  it.each([
    ["a 404", async () => new Response("Not Found", { status: 404 }), "doesn't publish /api/skins/schema yet (it needs PRD-259)"],
    ["a 500", async () => new Response("boom", { status: 500 }), "answered HTTP 500"],
    ["something else", async () => Response.json({ hello: "world" }), "didn't answer with a skin schema"],
    ["no answer", async () => Promise.reject(new TypeError("fetch failed")), "Automatos isn't running at http://studio.test:8000, and no --from"],
  ])("changes nothing on %s", async (_label, fetch, message) => {
    const out = capture();
    expect(await runSyncSchema([], out.io, deps({ fetch: vi.fn(fetch) }))).toBe(1);
    expect(out.error[0]).toContain(message);
    expect(out.error[0]).toMatch(/spec\/ is unchanged\.$/);
    expect(await spec()).toBe(OLD_SPEC);
  });

  it("reads the schema a checkout's schema.ts exports", async () => {
    const checkout = join(root, "automatos-ai");
    await mkdir(join(checkout, "frontend", "lib", "skins"), { recursive: true });
    await writeFile(join(checkout, CHECKOUT_SCHEMA), "export const skinJsonSchema = {};\n");
    const importModule = vi.fn(async () => ({ helper: 1, skinJsonSchema: { ...STUDIO_SCHEMA, "x-status": "v1" } }));
    const out = capture();
    expect(await runSyncSchema(["--from", checkout], out.io, deps({ importModule }))).toBe(0);
    expect(importModule.mock.calls[0]).toEqual([expect.stringMatching(/^file:.*frontend\/lib\/skins\/schema\.ts$/)]);
    const written = JSON.parse(await spec());
    expect(written["x-status"]).toBe("v1");
    expect(written["x-source"]).toEqual({ kind: "checkout", from: join(checkout, CHECKOUT_SCHEMA), syncedAt: NOW.toISOString() });
  });

  it("changes nothing when the checkout has no schema, or exports none", async () => {
    const out = capture();
    expect(await runSyncSchema(["--from", root], out.io, deps())).toBe(1);
    expect(out.error[0]).toContain("predates PRD-259");
    await mkdir(join(root, "frontend", "lib", "skins"), { recursive: true });
    await writeFile(join(root, CHECKOUT_SCHEMA), "export {};\n");
    expect(await runSyncSchema(["--from", root], out.io, deps())).toBe(1);
    expect(out.error[1]).toContain("exports no skin JSON Schema");
    expect(await spec()).toBe(OLD_SPEC);
  });

  it("explains its usage", async () => {
    const out = capture();
    expect(await runSyncSchema(["--from"], out.io, deps())).toBe(2);
    expect(out.error[0]).toContain("Usage: npm run sync-schema");
  });
});
