"use client";

// Automatos isn't running (mock 07): the whole window, Auto asleep, the one command that
// starts it, and Check again. Play also asks again on its own every 10 seconds.

import { useEffect, useState } from "react";

import { AutoMascot } from "@/components/mascot/AutoMascot";

import { Wordmark } from "./Wordmark";
import styles from "./edges.module.css";

export const ASLEEP_TITLE = "Automatos is asleep";
export const START_COMMAND = "docker compose up";
const COPIED_MS = 2000;

type CopyState = "idle" | "copied" | "failed";

export interface AsleepScreenProps {
  /** The proxy's own words, naming the address it tried. */
  readonly detail: string;
  readonly onCheck: () => void;
  readonly recheckSeconds: number;
}

function useCopy(text: string) {
  const [state, setState] = useState<CopyState>("idle");
  useEffect(() => {
    if (state !== "copied") return;
    const timer = setTimeout(() => setState("idle"), COPIED_MS);
    return () => clearTimeout(timer);
  }, [state]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch (error) {
      console.error("[asleep] couldn't copy the command:", error);
      setState("failed");
    }
  };
  return { state, copy };
}

const COPY_LABEL: Readonly<Record<CopyState, string>> = { idle: "Copy", copied: "Copied", failed: "Copy" };

export function AsleepScreen({ detail, onCheck, recheckSeconds }: AsleepScreenProps) {
  const { state, copy } = useCopy(START_COMMAND);
  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        <Wordmark />
        <span className={styles.status} role="status">
          Not connected
        </span>
      </header>
      <main className={styles.body}>
        <AutoMascot state="sleeping" size="large" showCaption={false} />
        <h1 className={styles.title}>{ASLEEP_TITLE}</h1>
        <p className={styles.text}>
          Play talks to Automatos on your computer, and it isn&apos;t running right now. Open a terminal in your{" "}
          <code className={styles.inline}>automatos-ai</code> folder and start it:
        </p>
        <div className={styles.command}>
          <span className={styles.prompt} aria-hidden="true">
            $
          </span>
          <code className={styles.commandText}>{START_COMMAND}</code>
          <button type="button" className={styles.copy} onClick={() => void copy()}>
            {COPY_LABEL[state]}
          </button>
        </div>
        {state === "failed" && (
          <p className={styles.hint} role="alert">
            Play couldn&apos;t copy it. Select the command and copy it yourself.
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.checkAgain} onClick={onCheck}>
            Check again
          </button>
          <span className={styles.hint}>Play also checks every {recheckSeconds} seconds.</span>
        </div>
        <p className={styles.hint}>{detail}</p>
      </main>
    </div>
  );
}
