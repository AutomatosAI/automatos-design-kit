// The run page's side panel data: the Mission's cost (GET /cost) and its Deliverables
// (GET /api/deliverables?source_type=mission&source_id=). Both are read when the page
// opens and again when the Mission's state or token count changes, never on a timer of
// their own, so the page adds no polling beyond the Mission's. The last answer stays on
// screen while the next is read.

import { useCallback, useEffect, useState } from "react";

import type { ApiClient } from "@/lib/client/api";
import type { Deliverable } from "@/lib/client/types";
import type { MissionCost } from "@/lib/missions/types";

export const COST_FAILED = "Play couldn't load what this Mission has cost.";
export const DELIVERABLES_FAILED = "Play couldn't load this Mission's Deliverables.";

export type Latest<T> = { readonly value: T | null; readonly error: string | null; readonly retry: () => void };

/** Reads whenever load or reason changes; keeps the last value through a later failure. */
function useLatest<T>(load: () => Promise<T>, reason: string, failed: string, label: string): Latest<T> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ readonly value: T | null; readonly error: string | null }>({ value: null, error: null });
  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  useEffect(() => {
    let live = true;
    load().then(
      (value) => {
        if (live) setState({ value, error: null });
      },
      (error: unknown) => {
        console.error(`[${label}] ${failed}`, error);
        if (live) setState((previous) => ({ ...previous, error: failed }));
      },
    );
    return () => {
      live = false;
    };
  }, [load, reason, failed, label, attempt]);

  return { ...state, retry };
}

async function missionDeliverables(client: ApiClient, id: string): Promise<readonly Deliverable[]> {
  const list = await client.listDeliverables({ sourceType: "mission", sourceId: id });
  // success: false carries raw exception text: the console gets it, the page a sentence.
  if (!list.success) throw new Error(list.error);
  return list.deliverables;
}

export interface MissionSide {
  readonly cost: Latest<MissionCost>;
  readonly deliverables: Latest<readonly Deliverable[]>;
}

export function useMissionSide(client: ApiClient, id: string, state: string, tokensUsed: number): MissionSide {
  const loadCost = useCallback(() => client.missionCost(id), [client, id]);
  const loadDeliverables = useCallback(() => missionDeliverables(client, id), [client, id]);
  // The reasons to read again: the cost moves with the tokens, Deliverables land as it runs and ends.
  return {
    cost: useLatest(loadCost, `${state}:${tokensUsed}`, COST_FAILED, "mission cost"),
    deliverables: useLatest(loadDeliverables, state, DELIVERABLES_FAILED, "mission deliverables"),
  };
}
