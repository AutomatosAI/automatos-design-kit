import { ownBuffer } from "@/lib/skins/assets";
import { AUTOSKIN_TYPE } from "@/lib/skins/pack";
import {
  IMPORT_SKIN_ROUTE,
  SKIN_FILE_FIELD,
  SKIN_KIT_HEADER,
  SKIN_KIT_HEADER_VALUE,
  SUBMIT_SKIN_ROUTE,
  studioMarketplaceUrl,
} from "@/lib/skins/sharing";

// The browser's one call for skins (PRD-004 K-007): post a packed .autoskin to the kit's own
// proxy route as a multipart form, with X-Skin-Kit: 1, and turn the answer into one sentence
// plus the reasons Automatos gave. Everything read from the answer is shown as text only.

export type SkinTarget = "import" | "submit";

export type SendResult =
  | { readonly ok: true; readonly message: string }
  | { readonly ok: false; readonly message: string; readonly reasons: readonly string[] };

export interface PackedSkin {
  readonly bytes: Uint8Array;
  readonly fileName: string;
  readonly name: string;
}

const ROUTES: Readonly<Record<SkinTarget, string>> = { import: IMPORT_SKIN_ROUTE, submit: SUBMIT_SKIN_ROUTE };
const REFUSED: Readonly<Record<SkinTarget, string>> = {
  import: "Your Automatos didn't load the skin.",
  submit: "The Marketplace didn't take the skin.",
};
const MAX_REASONS = 8;
const REASON_MAX = 300;
export const KIT_UNREACHABLE = "The Skin Kit's server didn't answer. Is npm run dev still running?";

/** The Marketplace page of the person's Automatos (NEXT_PUBLIC_AUTOMATOS_STUDIO_URL, or localhost:3000). */
export const MARKETPLACE_URL = studioMarketplaceUrl(process.env.NEXT_PUBLIC_AUTOMATOS_STUDIO_URL);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.length > REASON_MAX ? `${value.slice(0, REASON_MAX)}…` : value;
}

/** One reason from a validator error ({path, message}), a FastAPI detail item ({loc, msg}) or a string. */
function reasonOf(item: unknown): string | null {
  if (!isRecord(item)) return text(item);
  const message = text(item.message) ?? text(item.msg);
  const path = text(item.path);
  return message && path && path !== "$" ? `${path}: ${message}` : message;
}

function listReasons(value: unknown): readonly string[] {
  const items = Array.isArray(value) ? value : [value];
  return items.flatMap((item) => reasonOf(item) ?? []).slice(0, MAX_REASONS);
}

/** What Automatos (or the kit's route) said about a refusal: {error}, {detail} in its shapes, {errors}. */
export function refusalReasons(body: unknown): readonly string[] {
  if (!isRecord(body)) return [];
  const detail = body.detail;
  if (isRecord(detail) && Array.isArray(detail.errors)) return listReasons(detail.errors);
  const found = [body.error, detail, body.errors, body.message].find((value) => value !== undefined && value !== null);
  return found === undefined ? [] : listReasons(found);
}

function skinName(body: unknown, fallback: string): string {
  const named = isRecord(body) ? (text(body.name) ?? (isRecord(body.skin) ? text(body.skin.name) : null)) : null;
  return named ?? fallback;
}

/** The sentence for a skin Automatos took. */
export function acceptedMessage(target: SkinTarget, body: unknown, fallbackName: string): string {
  const name = skinName(body, fallbackName);
  if (target === "import") return `${name} is in your Automatos. Pick it in Studio under Style, Skins.`;
  const status = isRecord(body) ? body.status : undefined;
  if (status === "approved") return `${name} is on the Marketplace now.`;
  return `${name} was sent to the Marketplace. It shows there once it has been reviewed.`;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch (error) {
    console.warn(`[skins] the answer (HTTP ${response.status}) wasn't JSON:`, error);
    return null;
  }
}

function packedForm(skin: PackedSkin): FormData {
  const form = new FormData();
  form.append(SKIN_FILE_FIELD, new Blob([ownBuffer(skin.bytes)], { type: AUTOSKIN_TYPE }), skin.fileName);
  return form;
}

/** Sends a packed skin to the person's Automatos through the kit's proxy. Never throws. */
export async function sendSkin(target: SkinTarget, skin: PackedSkin): Promise<SendResult> {
  let response: Response;
  try {
    response = await fetch(ROUTES[target], {
      method: "POST",
      headers: { [SKIN_KIT_HEADER]: SKIN_KIT_HEADER_VALUE },
      body: packedForm(skin),
      cache: "no-store",
    });
  } catch (error) {
    console.error(`[skins] POST ${ROUTES[target]} failed:`, error);
    return { ok: false, message: KIT_UNREACHABLE, reasons: [] };
  }
  const body = await readJson(response);
  if (response.ok) return { ok: true, message: acceptedMessage(target, body, skin.name) };
  const reasons = refusalReasons(body);
  console.warn(`[skins] ${ROUTES[target]} answered HTTP ${response.status}:`, reasons);
  return { ok: false, message: REFUSED[target], reasons: reasons.length > 0 ? reasons : [`Automatos answered HTTP ${response.status}.`] };
}
