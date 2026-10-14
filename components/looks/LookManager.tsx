"use client";

// "This look" on the Looks page (PRD-002 L-005): the picked Look's own actions. A saved Look
// can be renamed, duplicated and deleted; a preset can only be duplicated. Duplicate, Export and
// Copy JSON take the active Look as it is now, edits included; Rename and Delete act on the
// saved Look it was picked from.

import { type FormEvent, useId, useState } from "react";

import { asDuplicate, baseLook, isSavedLook } from "@/lib/looks/editor";
import { DEFAULT_LOOK } from "@/lib/looks/presets";
import { LOOK_FILE_TYPE, lookFileName, lookJson } from "@/lib/looks/transfer";
import type { Look } from "@/lib/looks/types";

import { downloadText } from "./download";
import { useLook } from "./LookProvider";
import { LookNotice, type Notice, failed } from "./LookNotice";
import styles from "./manage.module.css";

export const MANAGE_LABEL = "This look";

type Mode = "rename" | "delete";

/** A message belongs to one Look: picking another Look hides it. */
interface ForLook<T> {
  readonly id: string;
  readonly value: T;
}

type Tell = (id: string, notice: Notice) => void;

/** Export and Copy JSON: the active Look as a file, or as text on the clipboard. */
function useTransfer(look: Look, tell: Tell) {
  const exportFile = () => {
    const fileName = lookFileName(look);
    try {
      downloadText(fileName, lookJson(look), LOOK_FILE_TYPE);
      tell(look.id, { kind: "done", text: `Downloaded ${fileName}.` });
    } catch (error) {
      console.error("[looks] export failed", error);
      tell(look.id, failed("That look wasn't exported.", ["The download didn't start. Use Copy JSON instead."]));
    }
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(lookJson(look));
      tell(look.id, { kind: "done", text: "Copied the JSON." });
    } catch (error) {
      console.error("[looks] copy failed", error);
      tell(look.id, failed("The JSON wasn't copied.", ["The browser blocked the clipboard. Use Export instead."]));
    }
  };

  return { exportFile, copyJson };
}

/** Duplicate, rename and delete, each through LookProvider so the whole app follows. */
function useManage(tell: Tell, closeForm: () => void) {
  const { look, saved, setLook, saveLook, deleteLook, renameLook } = useLook();

  const duplicate = (from: Look) => {
    const result = saveLook(asDuplicate(from, saved));
    if (!result.ok) return tell(look.id, failed("That look wasn't duplicated.", result.errors));
    setLook(result.look);
    tell(result.look.id, { kind: "done", text: `Duplicated as ${result.look.name}.` });
  };

  const rename = (from: Look, name: string) => {
    const result = renameLook(from.id, name);
    if (!result.ok) return tell(from.id, failed("That name wasn't saved.", result.errors));
    closeForm();
    tell(from.id, { kind: "done", text: `Renamed to ${result.look.name}.` });
  };

  // Deleting the active Look takes Play back to the default (lib/looks/store.ts).
  const remove = (from: Look) => {
    deleteLook(from.id);
    closeForm();
    tell(DEFAULT_LOOK.id, { kind: "done", text: `Deleted ${from.name}. Play is back to ${DEFAULT_LOOK.name}.` });
  };

  return { duplicate, rename, remove };
}

export function LookManager() {
  const { look, saved } = useLook();
  const [mode, setMode] = useState<Mode | null>(null);
  const [notice, setNotice] = useState<ForLook<Notice> | null>(null);
  const [shownFor, setShownFor] = useState(look.id);
  const headingId = useId();

  // Another Look picked: an open form, or a message about the old one, goes away for good
  // (reset while rendering, React's pattern for state that follows a prop).
  if (shownFor !== look.id) {
    setShownFor(look.id);
    setMode(null);
    if (notice !== null && notice.id !== look.id) setNotice(null);
  }

  const tell: Tell = (id, value) => setNotice({ id, value });
  const close = () => setMode(null);
  const open = (value: Mode) => {
    setNotice(null);
    setMode(value);
  };
  const { duplicate, rename, remove } = useManage(tell, close);
  const { exportFile, copyJson } = useTransfer(look, tell);

  const target = baseLook(look, saved);
  // Rename and Delete need one of the user's saved Looks; a preset has neither.
  const own = target !== undefined && isSavedLook(target, saved) ? target : undefined;

  return (
    <section className={styles.manage} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.label}>
        {MANAGE_LABEL}
      </h2>
      <div className={styles.toolbar}>
        {own && <ToolButton label="Rename" onClick={() => open("rename")} />}
        <ToolButton label="Duplicate" onClick={() => duplicate(look)} />
        {own && <ToolButton label="Delete" onClick={() => open("delete")} />}
        <ToolButton label="Export" onClick={exportFile} />
        <ToolButton label="Copy JSON" onClick={() => void copyJson()} />
      </div>
      {own && mode === "rename" && (
        <RenameForm key={own.id} look={own} onRename={(name) => rename(own, name)} onCancel={close} />
      )}
      {own && mode === "delete" && <DeleteConfirm look={own} onDelete={() => remove(own)} onCancel={close} />}
      <LookNotice notice={notice?.id === look.id ? notice.value : null} />
    </section>
  );
}

function ToolButton({ label, onClick }: { readonly label: string; readonly onClick: () => void }) {
  return (
    <button type="button" className={styles.action} onClick={onClick}>
      {label}
    </button>
  );
}

interface RenameFormProps {
  readonly look: Look;
  readonly onRename: (name: string) => void;
  readonly onCancel: () => void;
}

function RenameForm({ look, onRename, onCancel }: RenameFormProps) {
  const [name, setName] = useState(look.name);
  const fieldId = useId();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onRename(name);
  };
  return (
    <form className={styles.form} onSubmit={submit}>
      <label htmlFor={fieldId} className={styles.fieldLabel}>
        New name
      </label>
      <input
        id={fieldId}
        type="text"
        className={styles.field}
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoComplete="off"
        autoFocus
      />
      <div className={styles.formActions}>
        <button type="submit" className={styles.action}>
          Save name
        </button>
        <button type="button" className={styles.action} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

interface DeleteConfirmProps {
  readonly look: Look;
  readonly onDelete: () => void;
  readonly onCancel: () => void;
}

function DeleteConfirm({ look, onDelete, onCancel }: DeleteConfirmProps) {
  const textId = useId();
  return (
    <div className={styles.form} role="group" aria-labelledby={textId}>
      <p id={textId} className={styles.confirmText}>
        Delete {look.name}? This can&apos;t be undone. Export it first to keep a copy.
      </p>
      <div className={styles.formActions}>
        <button type="button" className={styles.danger} onClick={onDelete}>
          Delete look
        </button>
        <button type="button" className={styles.action} onClick={onCancel}>
          Keep it
        </button>
      </div>
    </div>
  );
}
