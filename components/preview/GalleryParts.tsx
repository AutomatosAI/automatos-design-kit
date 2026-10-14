// Studio's building blocks, drawn (components/ui: card, table, badge, button, input, select,
// checkbox): cards, a table with status badges, the five button variants, and the fields.

import { BUTTONS, TABLE_COLUMNS, TABLE_ROWS } from "./content";
import styles from "./parts.module.css";

const BUTTON_CLASSES: Readonly<Record<(typeof BUTTONS)[number]["kind"], string | undefined>> = {
  primary: styles.primary,
  secondary: styles.secondary,
  outline: styles.outline,
  destructive: styles.destructive,
  ghost: styles.ghost,
};

export function GalleryCards() {
  return (
    <div className={styles.cards}>
      <div className={styles.card}>
        <span className={styles.cardTitle}>Weekly report</span>
        <span className={styles.cardText}>Mission · step 3 of 4 · Writer</span>
        <span className={styles.progress} aria-hidden="true">
          <span className={styles.progressFill} />
        </span>
        <span className={styles.info}>Running</span>
      </div>
      <div className={styles.card}>
        <span className={styles.cardTitle}>Writer</span>
        <span className={styles.cardText}>Writes reports and turns them into Deliverables.</span>
        <span className={styles.agent}>Agent</span>
      </div>
      <div className={styles.card}>
        <span className={styles.cardTitle}>Friday report</span>
        <span className={styles.cardText}>Playbook · runs every Friday at 9:00</span>
        <span className={styles.cardFoot}>
          <span className={styles.success}>On</span>
          <span className={styles.ghost}>Edit</span>
        </span>
      </div>
    </div>
  );
}

export function GalleryTable() {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {TABLE_COLUMNS.map((column) => (
              <th key={column} className={styles.th} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TABLE_ROWS.map((row, index) => (
            <tr key={row.mission} className={index === 1 ? styles.rowHover : styles.row}>
              <td className={styles.td}>{row.mission}</td>
              <td className={styles.td}>
                <span className={styles.agent}>{row.agent}</span>
              </td>
              <td className={styles.td}>
                <span className={styles[row.tone]}>{row.status}</span>
              </td>
              <td className={styles.tdMuted}>{row.updated}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GalleryButtons() {
  return (
    <div className={styles.buttons}>
      {BUTTONS.map(({ kind, label }) => (
        <span key={kind} className={BUTTON_CLASSES[kind]} data-variant={kind}>
          {label}
        </span>
      ))}
    </div>
  );
}

export function GalleryControls() {
  return (
    <div className={styles.fields}>
      <span className={styles.field}>
        <span className={styles.label}>Playbook name</span>
        <span className={styles.input}>Friday report</span>
      </span>
      <span className={styles.field}>
        <span className={styles.label}>Mission goal (focused)</span>
        <span className={styles.inputFocused}>Draft the weekly report</span>
      </span>
      <span className={styles.field}>
        <span className={styles.label}>Agent</span>
        <span className={styles.select}>
          Writer
          <span className={styles.chevron} aria-hidden="true">
            ▾
          </span>
        </span>
      </span>
      <span className={styles.checks}>
        <span className={styles.checkRow}>
          <span className={styles.checkboxOn} aria-hidden="true">
            ✓
          </span>
          Ask Auto before it sends anything
        </span>
        <span className={styles.checkRow}>
          <span className={styles.checkbox} aria-hidden="true" />
          Save every Deliverable to Knowledge
        </span>
      </span>
    </div>
  );
}
