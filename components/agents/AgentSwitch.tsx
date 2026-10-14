"use client";

// An agent's on/off switch. A press opens a confirmation in the card (no confirm()
// dialog); only "Switch off" / "Switch on" sends PUT {status}. Keep closes it and puts
// focus back on the switch; a refusal stays in the form, in words.

import { type FormEvent, useEffect, useRef, useState } from "react";

import { SWITCH_FAILED } from "@/hooks/useCrew";
import { isOn, switchTarget, switchWords } from "@/lib/agents/crew";
import type { AgentSummary, AgentSwitchState } from "@/lib/agents/types";

import pageStyles from "../page/page.module.css";
import styles from "./agents.module.css";

export interface AgentSwitchProps {
  readonly agent: AgentSummary;
  readonly onSwitch: (agent: AgentSummary, status: AgentSwitchState) => Promise<void>;
}

type Phase = "closed" | "confirm" | "saving";

export function AgentSwitch({ agent, onSwitch }: AgentSwitchProps) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [error, setError] = useState<string | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  const on = isOn(agent);

  // After the render that closes the form: the switch is disabled while saving, and a
  // disabled button can't take focus.
  useEffect(() => {
    if (phase !== "closed" || !refocus.current) return;
    refocus.current = false;
    toggle.current?.focus();
  }, [phase]);

  const close = () => {
    refocus.current = true;
    setPhase("closed");
    setError(null);
  };

  const confirm = async () => {
    setPhase("saving");
    setError(null);
    try {
      await onSwitch(agent, switchTarget(agent));
      close();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : SWITCH_FAILED);
      setPhase("confirm");
    }
  };

  return (
    <div className={styles.switchArea}>
      <button
        ref={toggle}
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={agent.name}
        className={styles.toggle}
        disabled={phase === "saving"}
        onClick={() => setPhase("confirm")}
      >
        <span className={styles.track} data-on={on} aria-hidden="true">
          <span className={styles.thumb} />
        </span>
        <span aria-hidden="true">{on ? "On" : "Off"}</span>
      </button>
      {phase !== "closed" && (
        <SwitchConfirm agent={agent} saving={phase === "saving"} error={error} onConfirm={confirm} onKeep={close} />
      )}
    </div>
  );
}

interface SwitchConfirmProps {
  readonly agent: AgentSummary;
  readonly saving: boolean;
  readonly error: string | null;
  readonly onConfirm: () => void;
  readonly onKeep: () => void;
}

function SwitchConfirm({ agent, saving, error, onConfirm, onKeep }: SwitchConfirmProps) {
  const { question, confirm, keep } = switchWords(agent);
  const keepButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    keepButton.current?.focus();
  }, []);

  // A refusal: the button was disabled (so focus fell away) while it was saving.
  useEffect(() => {
    if (error) confirmButton.current?.focus();
  }, [error]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onConfirm();
  };

  return (
    <form className={styles.confirmPanel} aria-label={confirm} onSubmit={submit}>
      <p className={styles.question}>{question}</p>
      {error && (
        <p className={styles.alert} role="alert">
          <span aria-hidden="true">✕</span> {error}
        </p>
      )}
      <div className={styles.confirmActions}>
        <button ref={confirmButton} type="submit" className={styles.confirm} disabled={saving}>
          {confirm}
        </button>
        <button ref={keepButton} type="button" className={pageStyles.secondary} onClick={onKeep}>
          {keep}
        </button>
      </div>
    </form>
  );
}
