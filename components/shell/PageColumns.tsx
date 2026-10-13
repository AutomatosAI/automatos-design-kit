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
  /** Auto (components/mascot/AutoMascot), which carries his own caption. */
  readonly children: ReactNode;
}

export function MascotColumn({ children }: MascotColumnProps) {
  return (
    <aside className={styles.mascotColumn} aria-label="Auto">
      {children}
    </aside>
  );
}
