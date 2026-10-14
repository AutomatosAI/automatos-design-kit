import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import type { StorageSource } from "@/lib/looks/storage";
import { readStoredDraft, storageAvailable, writeStoredDraft } from "@/lib/skins/draft-store";
import { INITIAL_EDITOR_STATE, editorReducer, type DraftChange } from "@/lib/skins/editor-state";
import { canRedo, canUndo, type SkinDraft } from "@/lib/skins/model";

// The skin editor's draft: read from this browser after mount, written back after every change
// the user makes, with undo and redo on buttons and on the keyboard (Ctrl or Cmd + Z, Shift for
// redo, or Ctrl + Y). In a text field the keys stay the field's own undo.

export interface SkinEditorApi {
  readonly draft: SkinDraft;
  /** False until storage has been read. */
  readonly loaded: boolean;
  /** False when this browser refused to keep the draft. */
  readonly kept: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Applies a change; a run of changes with the same group is one undo step. */
  edit(change: DraftChange, group?: string): void;
  /** Ends a run of grouped changes (a picker or slider let go). */
  endGroup(): void;
  undo(): void;
  redo(): void;
}

const TEXT_INPUT_TYPES = new Set(["text", "search", "url", "email", "tel", "password", "number"]);

function isTextEntry(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type);
}

/** Which history step a key press asks for, if any. */
export function historyKey(event: KeyboardEvent): "undo" | "redo" | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || isTextEntry(event.target)) return null;
  const key = event.key.toLowerCase();
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  return key === "y" && !event.shiftKey ? "redo" : null;
}

function useHistoryKeys(undo: () => void, redo: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const step = historyKey(event);
      if (step === null) return;
      event.preventDefault();
      if (step === "undo") undo();
      else redo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);
}

export function useSkinEditor(storage: StorageSource): SkinEditorApi {
  const [state, dispatch] = useReducer(editorReducer, INITIAL_EDITOR_STATE);
  const [kept, setKept] = useState(true);
  const draft = state.history.present;

  useEffect(() => {
    dispatch({ type: "loaded", draft: readStoredDraft(storage) });
    setKept(storageAvailable(storage));
  }, [storage]);

  useEffect(() => {
    if (state.changed) setKept(writeStoredDraft(storage, draft));
  }, [storage, draft, state.changed]);

  const edit = useCallback((change: DraftChange, group?: string) => dispatch({ type: "edit", change, group }), []);
  const endGroup = useCallback(() => dispatch({ type: "endGroup" }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  useHistoryKeys(undo, redo);

  return useMemo(
    () => ({
      draft,
      loaded: state.loaded,
      kept,
      canUndo: canUndo(state.history),
      canRedo: canRedo(state.history),
      edit,
      endGroup,
      undo,
      redo,
    }),
    [draft, state.loaded, state.history, kept, edit, endGroup, undo, redo],
  );
}
