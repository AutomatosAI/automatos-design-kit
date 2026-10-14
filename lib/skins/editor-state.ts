import { commit, createHistory, redo, startDraft, undo, type DraftHistory, type SkinDraft } from "./model";

// The skin editor's state: the draft's undo/redo history, plus whether storage has been read
// and whether the user has changed anything since (only then is the draft written back).
//
// Edits can carry a `group`: a run of edits with the same group is one undo step. Dragging a
// colour picker or a slider sends dozens of changes, and one Undo should take back the drag,
// not its last pixel. Any other action ends the run. Pure.

export interface EditorState {
  readonly history: DraftHistory;
  /** The group of the last edit, while its run lasts. */
  readonly group: string | null;
  readonly loaded: boolean;
  readonly changed: boolean;
}

export type DraftChange = (draft: SkinDraft) => SkinDraft;

export type EditorAction =
  | { readonly type: "loaded"; readonly draft: SkinDraft | null }
  | { readonly type: "edit"; readonly change: DraftChange; readonly group?: string }
  | { readonly type: "endGroup" }
  | { readonly type: "undo" }
  | { readonly type: "redo" };

export const INITIAL_EDITOR_STATE: EditorState = {
  history: createHistory(startDraft("studio")),
  group: null,
  loaded: false,
  changed: false,
};

function applyEdit(state: EditorState, change: DraftChange, group: string | undefined): EditorState {
  const { history } = state;
  const next = change(history.present);
  if (next === history.present) return state;
  const continues = group !== undefined && group === state.group && history.past.length > 0;
  const nextHistory = continues ? { ...history, present: next, future: [] } : commit(history, next);
  if (nextHistory === history) return state;
  return { ...state, history: nextHistory, group: group ?? null, changed: true };
}

function moved(state: EditorState, history: DraftHistory): EditorState {
  return history === state.history ? { ...state, group: null } : { ...state, history, group: null, changed: true };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "loaded":
      // An edit made before storage answered wins over what storage held.
      if (state.changed || action.draft === null) return { ...state, loaded: true };
      return { ...state, history: createHistory(action.draft), loaded: true };
    case "edit":
      return applyEdit(state, action.change, action.group);
    case "endGroup":
      return state.group === null ? state : { ...state, group: null };
    case "undo":
      return moved(state, undo(state.history));
    case "redo":
      return moved(state, redo(state.history));
  }
}
