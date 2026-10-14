// What the caption under Auto says on the chat (mocks 01 and 02). The state's own words
// come from captionFor; the chat adds the detail it knows: the running search query, or
// that a Deliverable is on the shelf.

import { captionFor } from "@/lib/mascot/media";
import type { MascotName } from "@/lib/mascot/types";

import { toolDetail } from "./labels";
import type { AutoMessage, ChatMessage } from "./types";

export type ChatCaption = { readonly caption: string; readonly detail?: string };

export const ON_THE_SHELF = "It's on your shelf too.";
/** Asleep after the idle timeout, not because Automatos is down. */
export const NAPPING = "Having a little nap";
export const WAKE_HINT = "Move or type to wake me.";

const BUSY: ReadonlySet<MascotName> = new Set(["searching", "reading", "working"]);

export function latestReply(messages: readonly ChatMessage[]): AutoMessage | undefined {
  return messages.findLast((message): message is AutoMessage => message.role === "assistant");
}

export function chatCaption(state: MascotName, reply: AutoMessage | undefined, backendDown = false): ChatCaption {
  if (state === "sleeping" && !backendDown) return { caption: NAPPING, detail: WAKE_HINT };
  if (state === "celebrate" && reply?.deliverables.length) {
    const kind = reply.deliverables.at(-1)?.kind;
    return { caption: captionFor(state, kind), detail: ON_THE_SHELF };
  }
  if (BUSY.has(state) && reply) {
    const running = reply.tools.findLast((tool) => tool.status === "running");
    const detail = running ? toolDetail(running.input) : null;
    return detail ? { caption: captionFor(state), detail } : { caption: captionFor(state) };
  }
  return { caption: captionFor(state) };
}
