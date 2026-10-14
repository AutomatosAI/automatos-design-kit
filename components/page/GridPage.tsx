"use client";

// The grid page pattern (PRD-003 design rule 2): title and count, filter chips, a search
// box, the page's own grid or list, Load more, and the loading, empty and error states.
// Built on the shelf's layout; the page owns its data and says which state it is in.

import type { ReactNode } from "react";

import { PageColumns } from "@/components/shell/PageColumns";

import styles from "./page.module.css";
import { FilterChips, type FilterChipsProps, PageFailed, PageLoading, SearchBox, type SearchBoxProps } from "./parts";

export const LOAD_MORE = "Load more";
export const LOADING_MORE = "Loading more…";

export type GridStatus =
  | { readonly kind: "loading"; readonly text?: string }
  | { readonly kind: "failed"; readonly error: string; readonly retry: () => void }
  | {
      readonly kind: "empty";
      readonly message: string;
      /** A way forward ("Start a chat"). */
      readonly action?: ReactNode;
      /** Auto, on the pages where he means something (Knowledge). */
      readonly mascot?: ReactNode;
    }
  | { readonly kind: "ready" };

export interface LoadMore {
  readonly onLoadMore: () => void;
  readonly loading: boolean;
  /** A friendly sentence when the last Load more failed; the list stays. */
  readonly error?: string | null;
}

export interface GridPageProps<F extends string> {
  readonly title: string;
  /** "12 Missions"; left out until it is known. */
  readonly count?: string;
  /** The header's right side: the page's button, or Auto. */
  readonly actions?: ReactNode;
  /** Under the header, in every state: a stats strip, an open composer. */
  readonly lead?: ReactNode;
  readonly filters?: FilterChipsProps<F>;
  readonly search?: SearchBoxProps;
  readonly status: GridStatus;
  /** Shown while there is more to load (ready only). */
  readonly loadMore?: LoadMore;
  /** The grid or list itself (ready only). */
  readonly children?: ReactNode;
}

export function GridPage<F extends string>({
  title,
  count,
  actions,
  lead,
  filters,
  search,
  status,
  loadMore,
  children,
}: GridPageProps<F>) {
  return (
    <PageColumns>
      <div className={styles.gridPage}>
        <header className={styles.gridHeader}>
          <div className={styles.heading}>
            <h1 className={styles.gridTitle}>{title}</h1>
            {count && <p className={styles.count}>{count}</p>}
          </div>
          {actions && <div className={styles.headerActions}>{actions}</div>}
        </header>
        {lead}
        {(filters || search) && (
          <div className={styles.tools}>
            {filters && <FilterChips {...filters} />}
            {search && <SearchBox {...search} />}
          </div>
        )}
        <GridBody status={status} loadMore={loadMore}>
          {children}
        </GridBody>
      </div>
    </PageColumns>
  );
}

interface GridBodyProps {
  readonly status: GridStatus;
  readonly loadMore?: LoadMore;
  readonly children?: ReactNode;
}

function GridBody({ status, loadMore, children }: GridBodyProps) {
  if (status.kind === "loading") return <PageLoading text={status.text} />;
  if (status.kind === "failed") return <PageFailed error={status.error} retry={status.retry} />;
  if (status.kind === "empty") {
    return (
      <div className={styles.empty}>
        {status.mascot && <div className={styles.emptyMascot}>{status.mascot}</div>}
        <div className={styles.emptyText}>
          <p className={styles.status}>{status.message}</p>
          {status.action}
        </div>
      </div>
    );
  }
  return (
    <>
      {children}
      {loadMore && <LoadMoreRow {...loadMore} />}
    </>
  );
}

function LoadMoreRow({ onLoadMore, loading, error }: LoadMore) {
  return (
    <div className={styles.more}>
      {error && (
        <p className={styles.error} role="alert">
          <span aria-hidden="true">✕</span> {error}
        </p>
      )}
      <button type="button" className={styles.secondary} onClick={onLoadMore} disabled={loading}>
        {loading ? LOADING_MORE : LOAD_MORE}
      </button>
    </div>
  );
}
