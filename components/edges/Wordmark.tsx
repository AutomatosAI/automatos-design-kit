import styles from "./edges.module.css";

/** "Automatos Play" for the screens shown without the sidebar. */
export function Wordmark() {
  return (
    <div className={styles.wordmark}>
      Automatos <span className={styles.wordmarkPlay}>Play</span>
    </div>
  );
}
