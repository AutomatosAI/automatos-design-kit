// The style page's spacing scale and radii, drawn with the theme's own tokens, in the accent.

import { swatchStyle } from "@/components/looks/swatchStyle";
import { RADII, SPACING_STEPS } from "@/lib/looks/style";

import styles from "./style.module.css";

export const SPACING_LABEL = "Spacing · 4px base";
export const RADII_LABEL = "Radii";

export function StyleScale() {
  return (
    <>
      <section className={styles.section} aria-label={SPACING_LABEL}>
        <h2 className={styles.label}>{SPACING_LABEL}</h2>
        <ul className={styles.scale}>
          {SPACING_STEPS.map((step) => (
            <li key={step.token} className={styles.scaleItem}>
              <span className={styles.step} style={swatchStyle({ "--step": `var(${step.token})` })} aria-hidden="true" />
              {step.px}
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.section} aria-label={RADII_LABEL}>
        <h2 className={styles.label}>{RADII_LABEL}</h2>
        <ul className={styles.scale}>
          {RADII.map((radius) => (
            <li key={radius.kind} className={styles.scaleItem}>
              <span className={styles.radius} data-radius={radius.kind} aria-hidden="true" />
              {radius.label}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
