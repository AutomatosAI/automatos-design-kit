"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { isActive, type NavItem } from "./nav";
import styles from "./shell.module.css";

// The phone's More sheet (PRD-003 section 4): a modal dialog over the page. Focus
// starts on the first page, Tab and Shift+Tab stay inside, Escape, Close and the
// backdrop close it, and the caller puts focus back on the More button.

const FOCUSABLE = "a[href], button:not(:disabled)";

export interface MoreSheetProps {
  readonly id: string;
  readonly items: readonly NavItem[];
  readonly pathname: string;
  /** Escape, Close or the backdrop. Keep it stable (useCallback): the key listener follows it. */
  readonly onClose: () => void;
  /** A page in the sheet was picked. */
  readonly onPick: () => void;
}

function focusables(sheet: HTMLElement): readonly HTMLElement[] {
  return [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)];
}

/** Wraps Tab from the last element to the first and Shift+Tab the other way; pulls stray focus back in. */
function keepFocusInside(event: KeyboardEvent, sheet: HTMLElement): void {
  const items = focusables(sheet);
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  const active = document.activeElement;
  const inside = active instanceof Node && sheet.contains(active);
  if (event.shiftKey && (active === first || !inside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !inside)) {
    event.preventDefault();
    first.focus();
  }
}

export function MoreSheet({ id, items, pathname, onClose, onPick }: MoreSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    (sheet.querySelector<HTMLElement>("a[href]") ?? focusables(sheet)[0])?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const sheet = sheetRef.current;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab" && sheet) {
        keepFocusInside(event, sheet);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.sheetLayer}>
      {/* The backdrop is for pointers only; keyboards have Escape and Close. */}
      <div className={styles.scrim} aria-hidden="true" onClick={onClose} />
      <div ref={sheetRef} id={id} role="dialog" aria-modal="true" aria-labelledby={titleId} className={styles.sheet}>
        <div className={styles.sheetHeader}>
          <h2 id={titleId} className={styles.sheetTitle}>
            More
          </h2>
          <button type="button" className={styles.sheetClose} onClick={onClose}>
            Close
          </button>
        </div>
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={styles.sheetLink}
                aria-current={isActive(item.href, pathname) ? "page" : undefined}
                onClick={onPick}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
