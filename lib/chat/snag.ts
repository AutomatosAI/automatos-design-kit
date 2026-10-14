// When a reply hit a snag (mock 08): an e: line or another error in words, or a tool
// call that failed. The box shows once the turn is over, so a tool that fails while
// Auto carries on answering doesn't interrupt him mid-sentence, and never on an answer
// you stopped yourself.

import { failedToolSentence } from "./labels";
import type { AutoMessage } from "./types";

export const SNAG_TITLE = "I hit a snag";

/** The sentences for the snag box, or none when the reply has no snag (or is still coming in). */
export function snagLines(message: AutoMessage): readonly string[] {
  if (message.status === "streaming" || message.status === "stopped") return [];
  if (message.errors.length > 0) return message.errors;
  const failed = message.tools.filter((tool) => tool.status === "failed").map(failedToolSentence);
  return [...new Set(failed)];
}
