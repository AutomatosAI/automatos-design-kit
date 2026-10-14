// The message box (mocks 01 and 02). Enter sends, Shift+Enter adds a line, and Send
// becomes Stop while Auto answers. Focus and blur tell the mascot you're typing.

import { type FormEvent, type KeyboardEvent, useState } from "react";

import styles from "./composer.module.css";

export const PLACEHOLDER = "Message Auto";

export interface MessageBoxProps {
  readonly streaming: boolean;
  /** Resolves when the turn ends; false when nothing was sent. */
  readonly onSend: (text: string) => Promise<boolean>;
  readonly onStop: () => Promise<void>;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
  readonly initialDraft?: string;
  /** Focus the box as it appears (the first open, and after an example fills it). */
  readonly autoFocus?: boolean;
  /** The box's name and placeholder: "Message Auto" unless the chat is another agent's. */
  readonly label?: string;
}

export function MessageBox({
  streaming,
  onSend,
  onStop,
  onFocus,
  onBlur,
  initialDraft = "",
  autoFocus = false,
  label = PLACEHOLDER,
}: MessageBoxProps) {
  const [draft, setDraft] = useState(initialDraft);
  const ready = draft.trim().length > 0;

  const submit = () => {
    if (streaming || !ready) return;
    const text = draft;
    setDraft("");
    void onSend(text).then((sent) => {
      // Nothing went out (a turn was still ending): give the words back.
      if (!sent) setDraft((current) => current || text);
    });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  return (
    <form className={styles.box} onSubmit={onSubmit}>
      <textarea
        className={styles.input}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={label}
        aria-label={label}
        autoFocus={autoFocus}
        rows={1}
      />
      {streaming ? (
        <button type="button" className={styles.stop} onClick={() => void onStop()}>
          <span className={styles.stopIcon} aria-hidden="true" />
          Stop
        </button>
      ) : (
        <button type="submit" className={styles.send} disabled={!ready}>
          Send
        </button>
      )}
    </form>
  );
}
