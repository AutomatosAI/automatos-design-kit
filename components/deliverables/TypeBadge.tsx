// A Deliverable's type as a small coloured badge ("Report", "Slides"), used on the
// chat's Deliverable card and on the shelf.

import { typeLabel } from "@/lib/deliverables/shelf";

import styles from "./kinds.module.css";

export function TypeBadge({ kind }: { readonly kind: string }) {
  return (
    <span className={styles.typeBadge} data-kind={kind}>
      {typeLabel(kind)}
    </span>
  );
}
