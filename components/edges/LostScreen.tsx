// The 404 (mock 09): Auto lost in front of a giant hollow "404", and one way back.

import Link from "next/link";

import { AutoMascot } from "@/components/mascot/AutoMascot";

import styles from "./edges.module.css";

export const LOST_TITLE = "This page wandered off";
export const LOST_LINE = "Auto looked everywhere. It's not here.";

export function LostScreen() {
  return (
    <main className={styles.lost}>
      <div className={styles.stage404}>
        <span className={styles.big404} aria-hidden="true">
          404
        </span>
        <div className={styles.lostAuto}>
          <AutoMascot state="lost" showCaption={false} />
        </div>
      </div>
      <h1 className={styles.title}>{LOST_TITLE}</h1>
      <p className={styles.text}>{LOST_LINE}</p>
      <Link href="/" className={styles.primary}>
        Back to chat
      </Link>
    </main>
  );
}
