// A kit page that is in the nav but not built yet in this wave (PRD-004): its name, what it
// will hold, and the way back to the editor.

import Link from "next/link";

import styles from "./pending.module.css";

export type PendingPageId = "preview" | "examples";

interface PendingCopy {
  readonly title: string;
  readonly lead: string;
}

export const PENDING_PAGES: Readonly<Record<PendingPageId, PendingCopy>> = {
  preview: {
    title: "Preview",
    lead: "Studio's own components with your skin on them, in both bases and both tones. This gallery isn't built yet: the editor shows your changes live meanwhile.",
  },
  examples: {
    title: "Examples",
    lead: "Ember, Daylight, Workshop and Neon, ready to start a skin from. They aren't in the kit yet: start from a look in the editor meanwhile.",
  },
};

export function PendingPage({ page }: { readonly page: PendingPageId }) {
  const { title, lead } = PENDING_PAGES[page];
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lead}>{lead}</p>
      <Link href="/" className={styles.link}>
        Open the editor
      </Link>
    </main>
  );
}
