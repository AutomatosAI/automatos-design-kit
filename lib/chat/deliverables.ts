// Which Deliverables a turn made, for the inline card in the chat. Two sources:
// - the document tool's tool-data frame, {generated_document: {deliverable_id, title,
//   format, …}} (format_for_frontend in automatos-ai/orchestrator/modules/tools/
//   formatting/result_formatter.py). This is what the core sends today.
// - a done receipt whose link names a Deliverable (/deliverables/<id>, or the core's
//   open_url shape /deliverables?deliverable=<id>). Today's receipts only link cards
//   and agents (consumers/chatbot/receipts.py), so this one is for later.
// Both are untrusted: ids are checked before they go into a link.

import { asObject, text } from "@/lib/stream/fields";
import type { JsonObject, Receipt } from "@/lib/stream/types";

import type { AutoMessage, DeliverableRef } from "./types";

/** The same shape the proxy routes accept for an id (lib/server/forward.ts). */
const DELIVERABLE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const DELIVERABLE_PAGE = /^\/deliverables\/([^/]+)\/?$/;
const DELIVERABLES_LIST = /^\/deliverables\/?$/;
const OPEN_URL_PARAM = "deliverable";
/** Only for resolving relative links; never fetched. */
const LINK_BASE = "http://play.invalid";

const IMAGE_FORMATS: ReadonlySet<string> = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);
const VIDEO_FORMATS: ReadonlySet<string> = new Set(["mp4", "webm", "mov"]);
export const DEFAULT_KIND = "document";
export const UNTITLED = "Your Deliverable";

export function isDeliverableId(id: string): boolean {
  return DELIVERABLE_ID.test(id);
}

/** Play's page for one Deliverable (US-012). */
export function deliverableHref(id: string): string {
  return `/deliverables/${encodeURIComponent(id)}`;
}

/** The generated document's format as a shelf type: the core files non-social documents as "document". */
export function kindOfFormat(format: string | null): string {
  const lower = (format ?? "").toLowerCase();
  if (IMAGE_FORMATS.has(lower)) return "image";
  if (VIDEO_FORMATS.has(lower)) return "video";
  return DEFAULT_KIND;
}

/** The Deliverable in a tool-data payload, or null when it names none (or a bad id). */
export function deliverableFromToolData(data: JsonObject): DeliverableRef | null {
  const made = asObject(data["generated_document"]);
  if (!made) return null;
  const id = text(made, "deliverable_id");
  if (!id || !isDeliverableId(id)) return null;
  return {
    id,
    title: text(made, "title") ?? text(made, "filename") ?? UNTITLED,
    kind: kindOfFormat(text(made, "format")),
  };
}

function parseLink(link: string): URL | null {
  try {
    return new URL(link, LINK_BASE);
  } catch (error) {
    console.warn("[chat] a receipt link that isn't a URL:", link, error);
    return null;
  }
}

/** "/deliverables/<id>": the id, still to be checked. The URL parser leaves it percent-encoded. */
function idOnPage(url: URL): string | null {
  const raw = DELIVERABLE_PAGE.exec(url.pathname)?.[1];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch (error) {
    console.warn("[chat] a Deliverable link with a broken id:", raw, error);
    return null;
  }
}

/** The Deliverable id a receipt link names, else null. */
export function deliverableIdFromLink(link: string | null): string | null {
  if (!link) return null;
  const url = parseLink(link);
  if (!url) return null;
  const id = idOnPage(url) ?? (DELIVERABLES_LIST.test(url.pathname) ? url.searchParams.get(OPEN_URL_PARAM) : null);
  return id && isDeliverableId(id) ? id : null;
}

export function deliverablesFromReceipts(receipts: readonly Receipt[]): readonly DeliverableRef[] {
  return receipts.flatMap((receipt) => {
    const id = receipt.status === "done" ? deliverableIdFromLink(receipt.link) : null;
    return id ? [{ id, title: receipt.subject || UNTITLED, kind: DEFAULT_KIND }] : [];
  });
}

/** The reply with these Deliverables added; one card per id (the first one seen wins). */
export function withDeliverables(message: AutoMessage, found: readonly DeliverableRef[]): AutoMessage {
  const fresh = found.filter(
    (ref, index) =>
      !message.deliverables.some((known) => known.id === ref.id) &&
      found.findIndex((other) => other.id === ref.id) === index,
  );
  return fresh.length ? { ...message, deliverables: [...message.deliverables, ...fresh] } : message;
}

/** Shorthand for tool-data: the payload's Deliverable, if it has one. */
export function withToolData(message: AutoMessage, data: JsonObject): AutoMessage {
  const ref = deliverableFromToolData(data);
  return ref ? withDeliverables(message, [ref]) : message;
}
