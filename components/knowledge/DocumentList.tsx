// The documents, newest first: name, type, size, status and date per row; a row opens the
// document's page. And the search results that take the list's place: the excerpt as
// plain text (untrusted chunk text, never markup), how close a match, the file it is from.

import Link from "next/link";

import { StateChip } from "@/components/page/StateChip";
import {
  documentHref,
  documentName,
  similarityWords,
  sizeWords,
  statusChip,
  typeWords,
} from "@/lib/documents/knowledge";
import type { KnowledgeDocument, SearchAnswer } from "@/lib/documents/types";
import { shelfDate } from "@/lib/deliverables/shelf";

import pageStyles from "../page/page.module.css";
import styles from "./knowledge.module.css";

export const LIST_LABEL = "Your documents";
export const RESULTS_LABEL = "Search results";
export const CLEAR_SEARCH = "Clear search";

export function TypeBadge({ fileType, filename }: { readonly fileType: string; readonly filename: string }) {
  return <span className={styles.typeBadge}>{typeWords(fileType, filename)}</span>;
}

export interface DocumentListProps {
  readonly documents: readonly KnowledgeDocument[];
  readonly now: Date;
}

export function DocumentList({ documents, now }: DocumentListProps) {
  return (
    <ul className={styles.list} aria-label={LIST_LABEL}>
      {documents.map((document) => (
        <li key={document.id}>
          <DocumentRow document={document} now={now} />
        </li>
      ))}
    </ul>
  );
}

function DocumentRow({ document, now }: { readonly document: KnowledgeDocument; readonly now: Date }) {
  const size = sizeWords(document.fileSize);
  const date = shelfDate(document.uploadDate, now);
  return (
    <Link href={documentHref(document.id)} className={styles.row}>
      <span className={styles.rowMain}>
        <span className={styles.name}>{documentName(document)}</span>
        <span className={styles.meta}>
          <TypeBadge fileType={document.fileType} filename={document.filename} />
          {size && <span>{size}</span>}
          {date && <span>{date}</span>}
        </span>
      </span>
      <StateChip {...statusChip(document.status)} />
    </Link>
  );
}

export interface SearchResultsProps {
  readonly answer: SearchAnswer;
  readonly onClear: () => void;
}

/** "2 matches for “invoice”". */
export function matchesLine(answer: SearchAnswer): string {
  const total = answer.results.length;
  return `${total === 1 ? "1 match" : `${total} matches`} for “${answer.query}”`;
}

export function SearchResults({ answer, onClear }: SearchResultsProps) {
  return (
    <>
      <div className={styles.resultsHeader}>
        <p className={styles.resultsCount} role="status">
          {matchesLine(answer)}
        </p>
        <button type="button" className={pageStyles.secondary} onClick={onClear}>
          {CLEAR_SEARCH}
        </button>
      </div>
      <ul className={styles.list} aria-label={RESULTS_LABEL}>
        {answer.results.map((result) => {
          const match = similarityWords(result.similarity);
          return (
            <li key={result.documentId} className={styles.result}>
              <Link href={documentHref(result.documentId)} className={styles.resultLink}>
                {result.filename.trim() || "Untitled document"}
              </Link>
              <p className={styles.meta}>
                <TypeBadge fileType={result.fileType} filename={result.filename} />
                {match && <span>{match}</span>}
              </p>
              <p className={styles.excerpt}>{result.excerpt}</p>
            </li>
          );
        })}
      </ul>
    </>
  );
}
