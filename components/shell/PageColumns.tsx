import type { ReactNode } from "react";
import styles from "./shell.module.css";

export interface PageColumnsProps {
  readonly children: ReactNode;
  /** The right column: Auto and his caption. Hidden below 1024 px. */
  readonly mascot?: ReactNode;
}

/** The main column plus, optionally, the mascot column (mock 01). */
export function PageColumns({ children, mascot }: PageColumnsProps) {
  return (
    <div className={styles.columns}>
      <main className={styles.main}>{children}</main>
      {mascot}
    </div>
  );
}

export function PageHeader({ title, meta }: { readonly title: string; readonly meta?: string }) {
  return (
    <div className={styles.pageHeader}>
      <h1 className={styles.pageTitle}>{title}</h1>
      {meta && <span className={styles.pageMeta}>{meta}</span>}
    </div>
  );
}

export interface MascotColumnProps {
  /** The mascot itself (AutoMascot from US-007). */
  readonly children: ReactNode;
  /** What Auto is doing, in words: the mascot's text equivalent. */
  readonly caption: string;
  readonly detail?: string;
}

export function MascotColumn({ children, caption, detail }: MascotColumnProps) {
  return (
    <aside className={styles.mascotColumn} aria-label="Auto">
      {children}
      <div className={styles.caption}>
        <span className={styles.captionTitle}>{caption}</span>
        {detail && <span className={styles.captionDetail}>{detail}</span>}
      </div>
    </aside>
  );
}

/** A stand-in for Auto until the mascot player lands (US-007). */
export function MascotSlot() {
  return <div className={styles.mascotSlot} aria-hidden="true" />;
}
