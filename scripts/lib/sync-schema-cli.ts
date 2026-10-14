import { existsSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getBackendUrl } from "../../lib/server/backend";
import type { Io } from "./validate-cli";

// npm run sync-schema [--from <automatos-ai checkout>]: refreshes spec/ from Studio, which owns
// the automatos-skin/v1 format (core PRD-259 §3). Without --from it reads GET /api/skins/schema
// from the running Automatos; with it, the schema exported by the checkout's
// frontend/lib/skins/schema.ts. When neither answers, it says so and changes nothing.

export const SCHEMA_ROUTE = "/api/skins/schema";
export const CHECKOUT_SCHEMA = join("frontend", "lib", "skins", "schema.ts");
/** Export names tried in the checkout's schema.ts, in order. */
export const SCHEMA_EXPORTS = ["skinJsonSchema", "SKIN_JSON_SCHEMA", "skinSchema", "default"] as const;
export const FETCH_TIMEOUT_MS = 10_000;
const UNCHANGED = "spec/ is unchanged.";

type Json = Readonly<Record<string, unknown>>;

export interface SyncDeps {
  readonly fetch: typeof fetch;
  readonly importModule: (url: string) => Promise<unknown>;
  readonly specPath: string;
  readonly now: () => Date;
}

type Found = { readonly ok: true; readonly schema: Json; readonly kind: "backend" | "checkout"; readonly from: string } | { readonly ok: false; readonly message: string };

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Enough to tell a skin schema from something else: an object schema with a tokens property. */
export function looksLikeSkinSchema(value: unknown): value is Json {
  return isRecord(value) && isRecord(value.properties) && isRecord(value.properties.tokens);
}

async function fromBackend(deps: SyncDeps): Promise<Found> {
  let base: string;
  try {
    base = getBackendUrl();
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
  const url = `${base}${SCHEMA_ROUTE}`;
  try {
    const response = await deps.fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (response.status === 404) return { ok: false, message: `Your Automatos at ${base} doesn't publish ${SCHEMA_ROUTE} yet (it needs PRD-259).` };
    if (!response.ok) return { ok: false, message: `${url} answered HTTP ${response.status}.` };
    const schema: unknown = await response.json();
    if (!looksLikeSkinSchema(schema)) return { ok: false, message: `${url} didn't answer with a skin schema.` };
    return { ok: true, schema, kind: "backend", from: url };
  } catch (error) {
    console.error(`Fetching ${url} failed:`, error);
    return { ok: false, message: `Automatos isn't running at ${base}, and no --from <automatos-ai checkout> was given.` };
  }
}

async function fromCheckout(dir: string, deps: SyncDeps): Promise<Found> {
  const file = join(resolve(dir), CHECKOUT_SCHEMA);
  if (!existsSync(file)) return { ok: false, message: `There's no ${CHECKOUT_SCHEMA} in ${dir}: that checkout predates PRD-259.` };
  try {
    const loaded = await deps.importModule(pathToFileURL(file).href);
    const exported = isRecord(loaded) ? SCHEMA_EXPORTS.map((name) => loaded[name]).find(looksLikeSkinSchema) : undefined;
    if (!exported) return { ok: false, message: `${file} exports no skin JSON Schema (looked for ${SCHEMA_EXPORTS.join(", ")}).` };
    return { ok: true, schema: exported, kind: "checkout", from: file };
  } catch (error) {
    console.error(`Loading ${file} failed:`, error);
    return { ok: false, message: `Couldn't load ${file}. The details are above.` };
  }
}

/** Studio's schema with where it came from; Studio's own x-status is kept when it sends one. */
export function syncedSchema(found: Extract<Found, { ok: true }>, now: Date): Json {
  return {
    ...found.schema,
    "x-status": typeof found.schema["x-status"] === "string" ? found.schema["x-status"] : "published-by-studio",
    "x-source": { kind: found.kind, from: found.from, syncedAt: now.toISOString() },
  };
}

function parseArgs(args: readonly string[]): { readonly from: string | null } | null {
  if (args.length === 0) return { from: null };
  if (args.length === 2 && args[0] === "--from" && args[1]) return { from: args[1] };
  return null;
}

export async function runSyncSchema(args: readonly string[], io: Io, deps: SyncDeps): Promise<number> {
  const parsed = parseArgs(args);
  if (!parsed) {
    io.error("Usage: npm run sync-schema [-- --from <automatos-ai checkout>]");
    return 2;
  }
  const found = parsed.from === null ? await fromBackend(deps) : await fromCheckout(parsed.from, deps);
  if (!found.ok) {
    io.error(`${found.message} ${UNCHANGED}`);
    return 1;
  }
  const temporary = `${deps.specPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(syncedSchema(found, deps.now()), null, 2)}\n`, "utf8");
  await rename(temporary, deps.specPath);
  io.log(`Updated ${deps.specPath} from ${found.from}.`);
  return 0;
}
