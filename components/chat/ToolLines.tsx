// One mono line per tool call (mocks 01 and 02): a spinner and "Searching the web: '…'"
// while it runs, "✓ Searched the web · 3 results · 2.1 s" when it is done.

import { toolLineLabel } from "@/lib/chat/labels";
import type { ToolLine } from "@/lib/chat/types";

import styles from "./chat.module.css";

function ToolLineItem({ tool }: { readonly tool: ToolLine }) {
  const label = toolLineLabel(tool);
  return (
    <li className={styles.toolLine} data-tone={label.tone}>
      {label.mark === null ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        <span className={styles.mark} aria-hidden="true">
          {label.mark}
        </span>
      )}
      <span>{label.text}</span>
    </li>
  );
}

export function ToolLines({ tools }: { readonly tools: readonly ToolLine[] }) {
  if (tools.length === 0) return null;
  return (
    <ul className={styles.toolLines} aria-label="Tools Auto used">
      {tools.map((tool) => (
        <ToolLineItem key={tool.toolCallId} tool={tool} />
      ))}
    </ul>
  );
}
