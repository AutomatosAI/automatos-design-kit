import type { MascotName } from "@/lib/mascot/types";

import styles from "./mascot.module.css";

/**
 * The dashed stand-in from mascot.dc.html, shown while the files in public/auto/
 * load and for good when they are missing (they are git-ignored, so CI never has them).
 */
export function MascotPlaceholder({ state }: { readonly state: MascotName }) {
  return (
    <div className={styles.placeholder} data-testid="auto-placeholder" data-dim={state === "sleeping" || undefined}>
      <div className={styles.visor}>
        <span className={styles.eye} />
        <span className={styles.eye} />
      </div>
      <span className={styles.placeholderLabel}>{state}</span>
    </div>
  );
}
