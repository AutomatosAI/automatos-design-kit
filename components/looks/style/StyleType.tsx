// The style page's Type section: the display specimens in the Look's own type style and
// sizes, then the reading type (Geist in every Look) with its sizes.

import { TEXT_SPECIMENS, displayLine, displaySpecimens } from "@/lib/looks/style";
import type { Look } from "@/lib/looks/types";

import styles from "./style.module.css";

export const TYPE_LABEL = "Type";

/** Display specimens in order: hero, status, title. */
const DISPLAY_CLASSES = [styles.hero, styles.status, styles.title];

/** Each reading specimen is set in its app/theme.css token. */
const TEXT_CLASSES: Readonly<Record<string, string | undefined>> = {
  "--text-reply": styles.reply,
  "--text-body": styles.body,
  "--text-button-sm": styles.button,
  "--text-label": styles.caps,
  "--text-mono": styles.mono,
};

export function StyleType({ look }: { readonly look: Look }) {
  return (
    <section className={styles.section} aria-label={TYPE_LABEL}>
      <h2 className={styles.label}>{TYPE_LABEL}</h2>
      <dl className={styles.specimens}>
        {displaySpecimens(look).map((specimen, index) => (
          <div key={specimen.label} className={styles.specimen}>
            <dt className={styles.specimenLabel}>{specimen.label}</dt>
            <dd className={DISPLAY_CLASSES[index]}>{specimen.sample}</dd>
          </div>
        ))}
        {TEXT_SPECIMENS.map((specimen) => (
          <div key={specimen.label} className={styles.specimen}>
            <dt className={styles.specimenLabel}>{specimen.label}</dt>
            <dd className={TEXT_CLASSES[specimen.token]}>{specimen.sample}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.note}>
        Display: {displayLine(look)}. Reading: Geist 400–700 and Geist Mono in every look.
      </p>
    </section>
  );
}
