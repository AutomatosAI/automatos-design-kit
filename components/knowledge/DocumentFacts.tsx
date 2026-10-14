// A document's side panel: what it is and what Auto made of it (type, size, when it came
// and when it was read, how many passages he keeps, its description and tags, and a note
// when only part of the text could be kept).

import { shelfDate } from "@/lib/deliverables/shelf";
import { sizeWords, typeWords } from "@/lib/documents/knowledge";
import type { KnowledgeDocument } from "@/lib/documents/types";

import pageStyles from "../page/page.module.css";
import styles from "./knowledge.module.css";

export const ABOUT = "About this document";

/** "Auto kept 62% of the text." when the core measured less than it wants. */
export function partialNote(document: Pick<KnowledgeDocument, "partial" | "keptPercent">): string | null {
  if (!document.partial) return null;
  return document.keptPercent === null
    ? "Auto could keep only part of the text."
    : `Auto could keep only ${document.keptPercent}% of the text.`;
}

function facts(document: KnowledgeDocument, now: Date): readonly (readonly [string, string])[] {
  const rows: readonly (readonly [string, string])[] = [
    ["Type", typeWords(document.fileType, document.filename)],
    ["Size", sizeWords(document.fileSize)],
    ["Added", shelfDate(document.uploadDate, now)],
    ["Read", shelfDate(document.processedDate, now)],
    ["Passages", document.chunkCount === null ? "" : String(document.chunkCount)],
    ["Tags", document.tags.join(", ")],
  ];
  return rows.filter(([, value]) => value !== "");
}

export function DocumentFacts({ document, now }: { readonly document: KnowledgeDocument; readonly now: Date }) {
  const partial = partialNote(document);
  return (
    <section className={styles.section} aria-label={ABOUT}>
      <h2 className={pageStyles.sectionLabel}>{ABOUT}</h2>
      {document.description && <p className={styles.factValue}>{document.description}</p>}
      <dl className={styles.facts}>
        {facts(document, now).map(([label, value]) => (
          <div key={label} className={styles.factRow}>
            <dt className={styles.factLabel}>{label}</dt>
            <dd className={styles.factValue}>{value}</dd>
          </div>
        ))}
      </dl>
      {partial && <p className={styles.note}>{partial}</p>}
    </section>
  );
}
