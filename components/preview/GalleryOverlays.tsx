// Studio's overlays, drawn in place rather than floating: a confirm modal over its scrim
// (components/ui/alert-dialog) and two toasts (sonner), success and failure.

import { MODAL, TOASTS } from "./content";
import styles from "./overlays.module.css";

export function GalleryModal() {
  return (
    <div className={styles.scrim}>
      <div className={styles.modal}>
        <span className={styles.modalTitle}>{MODAL.title}</span>
        <span className={styles.modalText}>{MODAL.body}</span>
        <span className={styles.modalActions}>
          <span className={styles.cancel}>{MODAL.cancel}</span>
          <span className={styles.confirm}>{MODAL.confirm}</span>
        </span>
      </div>
    </div>
  );
}

export function GalleryToasts() {
  return (
    <div className={styles.toasts}>
      {TOASTS.map((toast) => (
        <div key={toast.title} className={styles.toast} data-tone={toast.tone}>
          <span className={styles.toastMark} aria-hidden="true">
            {toast.tone === "success" ? "✓" : "!"}
          </span>
          <span className={styles.toastText}>
            <span className={styles.toastTitle}>{toast.title}</span>
            <span className={styles.toastBody}>{toast.text}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
