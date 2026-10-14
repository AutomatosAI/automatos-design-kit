// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deliverableFromToolData,
  deliverableHref,
  deliverableIdFromLink,
  deliverablesFromReceipts,
  kindOfFormat,
  UNTITLED,
} from "@/lib/chat/deliverables";
import { applyStreamEvent, autoMessage } from "@/lib/chat/turn";
import type { AutoMessage } from "@/lib/chat/types";
import type { Receipt, StreamEvent } from "@/lib/stream/types";

const ID = "9b2f4c1e-7a3d-4e5f-8a90-1b2c3d4e5f60";

/** What format_for_frontend sends for a made document (result_formatter.py). */
const MADE = {
  generated_document: {
    filename: "laptop-shortlist.pdf",
    format: "pdf",
    title: "Laptop shortlist",
    deliverable_id: ID,
    download_url: "/api/documents/generated/laptop-shortlist.pdf",
  },
};

function receipt(overrides: Partial<Receipt>): Receipt {
  return {
    action: "make",
    kind: "write",
    status: "done",
    subject: "Laptop shortlist",
    effect: "document made",
    link: null,
    reason: null,
    ...overrides,
  };
}

const apply = (events: readonly StreamEvent[]): AutoMessage => events.reduce(applyStreamEvent, autoMessage("r1"));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Deliverables from tool-data", () => {
  it("reads the generated document's id, title and type", () => {
    expect(deliverableFromToolData(MADE)).toEqual({ id: ID, title: "Laptop shortlist", kind: "document" });
  });

  it("ignores payloads without one, and ids that can't go in a link", () => {
    expect(deliverableFromToolData({ receipts: { receipts: [] } })).toBeNull();
    expect(deliverableFromToolData({ generated_document: { title: "x" } })).toBeNull();
    expect(deliverableFromToolData({ generated_document: { deliverable_id: "../../admin" } })).toBeNull();
    expect(deliverableFromToolData({ generated_document: { deliverable_id: 42 } })).toBeNull();
  });

  it("falls back to the filename, then a plain name", () => {
    expect(deliverableFromToolData({ generated_document: { deliverable_id: ID, filename: "a.pdf" } })?.title).toBe("a.pdf");
    expect(deliverableFromToolData({ generated_document: { deliverable_id: ID } })?.title).toBe(UNTITLED);
  });

  it("maps formats to shelf types", () => {
    expect(kindOfFormat("PNG")).toBe("image");
    expect(kindOfFormat("mp4")).toBe("video");
    expect(kindOfFormat("docx")).toBe("document");
    expect(kindOfFormat(null)).toBe("document");
  });
});

describe("Deliverables from receipt links", () => {
  it("finds the id on Play's page and on the core's open_url", () => {
    expect(deliverableIdFromLink(`/deliverables/${ID}`)).toBe(ID);
    expect(deliverableIdFromLink(`http://localhost:3000/deliverables?tab=outputs&deliverable=${ID}`)).toBe(ID);
  });

  it("ignores card and agent pages, and bad ids", () => {
    expect(deliverableIdFromLink("/command-center?tab=board&task_id=12")).toBeNull();
    expect(deliverableIdFromLink("/agents?agent=7")).toBeNull();
    expect(deliverableIdFromLink("/deliverables/a%2Fb")).toBeNull();
    expect(deliverableIdFromLink(null)).toBeNull();
  });

  it("only done receipts count", () => {
    const link = `/deliverables/${ID}`;
    expect(deliverablesFromReceipts([receipt({ link }), receipt({ link, status: "refused" })])).toEqual([
      { id: ID, title: "Laptop shortlist", kind: "document" },
    ]);
  });

  it("the href is Play's own detail page", () => {
    expect(deliverableHref(ID)).toBe(`/deliverables/${ID}`);
  });
});

describe("the reply's Deliverables", () => {
  it("tool-data adds a card; the same id from the receipts doesn't add another", () => {
    const reply = apply([
      { type: "tool-data", data: MADE },
      { type: "receipts", receipts: [receipt({ link: `/deliverables/${ID}` })], model: null, above: [] },
    ]);
    expect(reply.deliverables).toEqual([{ id: ID, title: "Laptop shortlist", kind: "document" }]);
  });

  it("other tool-data changes nothing", () => {
    const start = autoMessage("r1");
    expect(applyStreamEvent(start, { type: "tool-data", data: { receipts: { receipts: [] } } })).toBe(start);
  });

  it("doesn't mutate the reply it was given", () => {
    const start = Object.freeze(autoMessage("r1"));
    const next = applyStreamEvent(start, { type: "tool-data", data: MADE });
    expect(start.deliverables).toEqual([]);
    expect(next.deliverables).toHaveLength(1);
  });
});
