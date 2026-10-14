// The board's message line (B-003): why a move or a decision didn't happen (the move
// rules' sentence, or the backend's own message), and a line when a refetch failed and
// the board may be out of date.

import type { BoardNotice as Notice } from "@/hooks/useBoardActions";
import { REFRESH_FAILED } from "@/hooks/useBoard";

import pageStyles from "../page/page.module.css";
import styles from "./board.module.css";

export const DISMISS = "Dismiss";

export interface BoardNoticeProps {
  readonly notice: Notice;
  readonly stale: boolean;
  readonly onDismiss: () => void;
}

export function BoardNotice({ notice, stale, onDismiss }: BoardNoticeProps) {
  if (!notice && !stale) return null;
  return (
    <div className={styles.notices}>
      {stale && <p className={pageStyles.status}>{REFRESH_FAILED}</p>}
      {notice && (
        <div className={styles.notice} role="alert">
          <p className={pageStyles.error}>
            <span aria-hidden="true">✕</span> {notice.text}
          </p>
          <button type="button" className={pageStyles.secondary} onClick={onDismiss}>
            {DISMISS}
          </button>
        </div>
      )}
    </div>
  );
}
