"use client";

// One colour of one tone: a colour picker and a text field that takes #rrggbb or an HSL triplet
// ("16 100% 50%", what Studio stores). The picker applies as it moves (one undo step per drag);
// the text field applies on Enter or when it loses focus, and says so when it can't read a value.

import { useId, useState, type KeyboardEvent } from "react";

import { normaliseColour, tripletToHex } from "@/lib/skins/colour";

import styles from "./colours.module.css";

export const COLOUR_FORMAT_HINT = "Use #rrggbb or an HSL triplet such as 16 100% 50%.";

export interface ColourFieldProps {
  /** "primary, Light": the picker's name; the text field adds ", hex or HSL". */
  readonly label: string;
  /** The colour shown, as an HSL triplet; null when neither the skin nor its base sets it. */
  readonly value: string | null;
  /** Where the picker starts when there is no value (a triplet). */
  readonly pickerStart: string;
  /** A picked or typed colour (#rrggbb or a triplet), already checked. */
  readonly onPick: (colour: string) => void;
  readonly onType: (colour: string) => void;
  /** The picker was let go. */
  readonly onDone: () => void;
}

function ColourText({ label, value, onType }: Pick<ColourFieldProps, "label" | "value" | "onType">) {
  const errorId = useId();
  const current = value ?? "";
  const [text, setText] = useState(current);
  const [shown, setShown] = useState(current);
  const [invalid, setInvalid] = useState(false);
  // The draft changed under the field (a pick, undo, a suggestion): show its value.
  if (shown !== current) {
    setShown(current);
    setText(current);
    setInvalid(false);
  }

  const apply = () => {
    const typed = text.trim();
    const readable = typed === current || normaliseColour(typed) !== null;
    setInvalid(!readable);
    if (readable && typed !== current) onType(typed);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    apply();
  };

  return (
    <>
      <input
        className={styles.text}
        type="text"
        aria-label={`${label}, hex or HSL`}
        value={text}
        placeholder="Not set"
        spellCheck={false}
        autoComplete="off"
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        onChange={(event) => setText(event.target.value)}
        onBlur={apply}
        onKeyDown={onKeyDown}
      />
      {invalid && (
        <p id={errorId} className={styles.error} role="alert">
          {COLOUR_FORMAT_HINT}
        </p>
      )}
    </>
  );
}

export function ColourField({ label, value, pickerStart, onPick, onType, onDone }: ColourFieldProps) {
  return (
    <div className={styles.controls}>
      <input
        className={styles.picker}
        type="color"
        aria-label={label}
        value={tripletToHex(value ?? pickerStart).toLowerCase()}
        onChange={(event) => onPick(event.target.value)}
        onBlur={onDone}
      />
      <ColourText label={label} value={value} onType={onType} />
    </div>
  );
}
