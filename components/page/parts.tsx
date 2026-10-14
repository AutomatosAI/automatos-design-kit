"use client";

// The pieces the three page patterns share: filter chips, the search box, the back link,
// the loading line and the error state with Try again. Same look as the shelf and the
// conversations list, in the Look's colours.

import Link from "next/link";
import type { ChangeEvent, FormEvent } from "react";

import styles from "./page.module.css";

export const LOADING = "Loading…";
export const TRY_AGAIN = "Try again";
export const PROGRESS = "Progress";

export interface FilterOption<F extends string> {
  readonly value: F;
  readonly label: string;
}

export interface FilterChipsProps<F extends string> {
  /** Names the group for screen readers ("Show Missions by state"). */
  readonly label: string;
  readonly options: readonly FilterOption<F>[];
  readonly selected: F;
  readonly onSelect: (value: F) => void;
}

export function FilterChips<F extends string>({ label, options, selected, onSelect }: FilterChipsProps<F>) {
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.chip}
          aria-pressed={option.value === selected}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export const SEARCH = "Search";

export interface SearchBoxProps {
  /** The box's name and its placeholder ("Search Missions"). */
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /**
   * Search on Enter or the Search button instead of on every key (a search that costs a
   * backend call, like Knowledge's). Left out, the box filters as it is typed in.
   */
  readonly onSubmit?: () => void;
}

export function SearchBox({ label, value, onChange, onSubmit }: SearchBoxProps) {
  const onInput = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value);
  const box = (
    <input
      type="search"
      className={styles.search}
      aria-label={label}
      placeholder={label}
      value={value}
      onChange={onInput}
    />
  );
  if (!onSubmit) return box;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form role="search" className={styles.searchForm} aria-label={label} onSubmit={submit}>
      {box}
      <button type="submit" className={styles.secondary}>
        {SEARCH}
      </button>
    </form>
  );
}

export interface BackLinkProps {
  readonly href: string;
  /** Where it goes ("Missions"); the arrow is drawn, not read. */
  readonly label: string;
}

export function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link href={href} className={styles.back}>
      <span aria-hidden="true">← </span>
      {label}
    </Link>
  );
}

export function PageLoading({ text = LOADING }: { readonly text?: string }) {
  return (
    <p className={styles.status} role="status">
      {text}
    </p>
  );
}

export interface PageFailedProps {
  /** A friendly sentence; the console already has the detail. */
  readonly error: string;
  readonly retry: () => void;
}

export function PageFailed({ error, retry }: PageFailedProps) {
  return (
    <div className={styles.failed} role="alert">
      <p className={styles.error}>
        <span aria-hidden="true">✕</span> {error}
      </p>
      <button type="button" className={styles.primary} onClick={retry}>
        {TRY_AGAIN}
      </button>
    </div>
  );
}

export interface RunProgress {
  readonly value: number;
  readonly max: number;
  /** Says it in words: "3 of 5 steps done". */
  readonly label: string;
}

/** 0-100, whole; nothing done when there is nothing to do. */
export function progressPercent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.round((Math.min(Math.max(value, 0), max) / max) * 100);
}

export interface ProgressBarProps extends RunProgress {
  /** The bar's name ("Progress"); the label says how far. */
  readonly name?: string;
}

/** A bar with its words under it: the run page's header, a Mission card. */
export function ProgressBar({ value, max, label, name = PROGRESS }: ProgressBarProps) {
  const percent = progressPercent(value, max);
  return (
    <div className={styles.progress}>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label={name}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={label}
      >
        <div className={styles.progressFill} style={{ width: `${percent}%` }} />
      </div>
      <p className={styles.progressLabel}>{label}</p>
    </div>
  );
}
