// The Deliverable Auto just made, inline in his reply (mock 02): a printed-sheet tile,
// the title, the type badge, and Open, which goes to the Deliverable's page.

import Link from "next/link";

import { TypeBadge } from "@/components/deliverables/TypeBadge";
import { deliverableHref } from "@/lib/chat/deliverables";
import type { DeliverableRef } from "@/lib/chat/types";

import styles from "./chat.module.css";

export function DeliverableCard({ deliverable }: { readonly deliverable: DeliverableRef }) {
  return (
    <article className={styles.deliverable} aria-label={`Deliverable: ${deliverable.title}`}>
      <span className={styles.deliverableTile} data-kind={deliverable.kind} aria-hidden="true" />
      <div className={styles.deliverableText}>
        <h3 className={styles.deliverableTitle}>{deliverable.title}</h3>
        <p className={styles.deliverableMeta}>
          <TypeBadge kind={deliverable.kind} />
          just now
        </p>
      </div>
      <Link
        href={deliverableHref(deliverable.id)}
        className={styles.openButton}
        aria-label={`Open ${deliverable.title}`}
      >
        Open
      </Link>
    </article>
  );
}
