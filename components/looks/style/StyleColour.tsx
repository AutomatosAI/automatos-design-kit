// The style page's Colour section: a swatch for every colour the Look sets (name, value,
// role, and why a readable variant differs from its raw colour), then the live contrast ratios
// with an AA verdict in a glyph and a word, never colour alone.

import { colourStyle } from "@/components/looks/swatchStyle";
import { colourSwatches, contrastChecks, formatRatio, type ContrastCheck } from "@/lib/looks/style";
import type { Look } from "@/lib/looks/types";

import styles from "./style.module.css";

export const COLOUR_LABEL = "Colour";
export const CONTRAST_CAPTION = "Contrast, live";

function Verdict({ check }: { readonly check: ContrastCheck }) {
  return (
    <span className={styles.verdict} data-passes={check.passes}>
      <span aria-hidden="true">{check.passes ? "✓" : "✕"}</span> {check.passes ? "AA pass" : "AA fail"}
    </span>
  );
}

function ContrastTable({ look }: { readonly look: Look }) {
  return (
    <table className={styles.contrast}>
      <caption className={styles.caption}>{CONTRAST_CAPTION}</caption>
      <thead>
        <tr>
          <th scope="col">Pair</th>
          <th scope="col">Colours</th>
          <th scope="col">Ratio</th>
          <th scope="col">WCAG AA</th>
        </tr>
      </thead>
      <tbody>
        {contrastChecks(look).map((check) => (
          <tr key={check.label}>
            <th scope="row">{check.label}</th>
            <td>
              {check.foreground} on {check.background}
            </td>
            <td>{formatRatio(check.ratio)}</td>
            <td>
              <Verdict check={check} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StyleColour({ look }: { readonly look: Look }) {
  return (
    <section className={styles.section} aria-label={COLOUR_LABEL}>
      <h2 className={styles.label}>{COLOUR_LABEL}</h2>
      <ul className={styles.swatches}>
        {colourSwatches(look).map((swatch) => (
          <li key={swatch.name} className={styles.swatch}>
            <span className={styles.swatchChip} style={colourStyle(swatch.value)} aria-hidden="true" />
            <span className={styles.tokenName}>{swatch.name}</span>
            <span className={styles.tokenValue}>{swatch.value}</span>
            <span className={styles.tokenRole}>{swatch.role}</span>
            {swatch.note && <span className={styles.tokenNote}>{swatch.note}</span>}
          </li>
        ))}
      </ul>
      <ContrastTable look={look} />
    </section>
  );
}
