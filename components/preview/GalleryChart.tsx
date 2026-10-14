// A small bar chart (one bar per chart token, chart-1 to chart-5) and a line chart (chart-1 and
// chart-2), as Studio's analytics draw them. The geometry is in viewBox units, so the SVGs
// scale with the frame; the colours are classes reading Studio's chart tokens.

import { BAR_SERIES, LINE_SERIES } from "./content";
import styles from "./chart.module.css";

const VIEW_WIDTH = 200;
const VIEW_HEIGHT = 100;
const PAD = 8;
const SERIES_CLASSES = [styles.series1, styles.series2, styles.series3, styles.series4, styles.series5];

interface Bar {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Bars side by side across the plot, scaled to the largest value. */
export function barGeometry(values: readonly number[]): readonly Bar[] {
  const top = Math.max(1, ...values);
  const slot = (VIEW_WIDTH - PAD * 2) / Math.max(1, values.length);
  const width = slot * 0.6;
  return values.map((value, index) => {
    const height = ((VIEW_HEIGHT - PAD * 2) * value) / top;
    return { x: PAD + slot * index + (slot - width) / 2, y: VIEW_HEIGHT - PAD - height, width, height };
  });
}

/** An SVG polyline's points for each series, all on one scale. */
export function linePoints(series: readonly (readonly number[])[]): readonly string[] {
  const top = Math.max(1, ...series.flat());
  const longest = Math.max(2, ...series.map((values) => values.length));
  const step = (VIEW_WIDTH - PAD * 2) / (longest - 1);
  return series.map((values) =>
    values
      .map((value, index) => {
        const x = PAD + step * index;
        const y = VIEW_HEIGHT - PAD - ((VIEW_HEIGHT - PAD * 2) * value) / top;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" "),
  );
}

function Legend({ labels }: { readonly labels: readonly string[] }) {
  return (
    <ul className={styles.legend}>
      {labels.map((label, index) => (
        <li key={label} className={styles.legendItem}>
          <span className={`${styles.swatch} ${SERIES_CLASSES[index] ?? ""}`} aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  );
}

const VIEW_BOX = `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`;
const BASELINE = VIEW_HEIGHT - PAD;

export function GalleryChart() {
  const bars = barGeometry(BAR_SERIES.map((series) => series.value));
  const lines = linePoints(LINE_SERIES.map((series) => series.values));
  return (
    <div className={styles.charts}>
      <div className={styles.chartCard}>
        <span className={styles.chartTitle}>Deliverables this week</span>
        <svg className={styles.plot} viewBox={VIEW_BOX} role="img" aria-label="Bar chart of Deliverables by kind">
          <line className={styles.axis} x1={PAD} x2={VIEW_WIDTH - PAD} y1={BASELINE} y2={BASELINE} />
          {bars.map((bar, index) => (
            <rect key={index} className={SERIES_CLASSES[index]} {...bar} />
          ))}
        </svg>
        <Legend labels={BAR_SERIES.map((series) => series.label)} />
      </div>
      <div className={styles.chartCard}>
        <span className={styles.chartTitle}>Missions per day</span>
        <svg className={styles.plot} viewBox={VIEW_BOX} role="img" aria-label="Line chart of Missions done and failed">
          <line className={styles.axis} x1={PAD} x2={VIEW_WIDTH - PAD} y1={BASELINE} y2={BASELINE} />
          {lines.map((points, index) => (
            <polyline key={index} className={`${styles.line} ${SERIES_CLASSES[index] ?? ""}`} points={points} />
          ))}
        </svg>
        <Legend labels={LINE_SERIES.map((series) => series.label)} />
      </div>
    </div>
  );
}
