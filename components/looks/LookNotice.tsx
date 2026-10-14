// What the last manage or import action did, in words. Successes go to a polite live region
// that is always present (so screen readers hear the change); failures are an alert listing
// the reasons. Everything here is React text: imported names are never read as HTML.

import styles from "./manage.module.css";

export type Notice =
  | { readonly kind: "done"; readonly text: string }
  | { readonly kind: "failed"; readonly title: string; readonly errors: readonly string[] };

export function LookNotice({ notice }: { readonly notice: Notice | null }) {
  return (
    <>
      <p className={styles.done} aria-live="polite">
        {notice?.kind === "done" ? notice.text : ""}
      </p>
      {notice?.kind === "failed" && (
        <div className={styles.errors} role="alert">
          <p className={styles.errorTitle}>{notice.title}</p>
          <ul className={styles.errorList}>
            {notice.errors.map((error, index) => (
              <li key={`${index}-${error}`}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/** A failure: shown as an alert, and logged with the same reasons. */
export function failed(title: string, errors: readonly string[]): Notice {
  console.warn(`[looks] ${title}`, errors);
  return { kind: "failed", title, errors };
}
