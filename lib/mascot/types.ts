// The mascot's states and the events that move it. Spec:
// skills/build-automatos-interface/references/mascot-states.md.

import type { StreamEvent } from "@/lib/stream/types";

import type { ToolActivity } from "./tools";

export const MASCOT_STATES = [
  "hello",
  "idle",
  "listening",
  "thinking",
  "working",
  "searching",
  "reading",
  "celebrate",
  "oops",
  "sleeping",
  "lost",
  "loading",
] as const;

export type MascotName = (typeof MASCOT_STATES)[number];

/** Play once, then return to idle (or to what was queued meanwhile). */
export const ONE_SHOTS: ReadonlySet<MascotName> = new Set<MascotName>(["hello", "celebrate"]);

/** Swap at once instead of waiting for the clip boundary. */
export const URGENT: ReadonlySet<MascotName> = new Set<MascotName>(["oops", "hello"]);

/**
 * Priority when several things are true at once (higher wins):
 * oops > celebrate > listening (waiting) > searching = reading > working > thinking
 * > listening (typing) > idle. hello sits with celebrate; sleeping and lost sit
 * below idle, so any activity wakes Auto up.
 */
export const RANK = {
  oops: 8,
  oneShot: 7,
  waiting: 6,
  tool: 5,
  working: 4,
  thinking: 3,
  typing: 2,
  idle: 1,
  rest: 0,
} as const;

/** A state on screen, with the priority of the reason it is there. */
export type Pose = { readonly mascot: MascotName; readonly rank: number };

export type OpenTool = { readonly toolCallId: string; readonly activity: ToolActivity };

export type MascotState = {
  /** What Auto shows now (the player swaps to it at the next clip boundary). */
  readonly mascot: MascotName;
  readonly rank: number;
  /** What plays when the current one-shot ends (null: idle). */
  readonly queued: Pose | null;
  /** Tool calls started and not yet ended in this turn. */
  readonly openTools: readonly OpenTool[];
  /** A message was sent and the turn hasn't finished or failed. */
  readonly turnActive: boolean;
  /** This turn's receipts include a done receipt: celebrate on finish. */
  readonly celebrateOnFinish: boolean;
  /** The backend is unreachable: Auto sleeps until backend-up. */
  readonly backendDown: boolean;
};

/**
 * Events from the page, not the stream. app-open means the first open in this
 * browser session (the caller checks). clip-ended names the clip that ended, so a
 * stale one can't end a newer one-shot. request-failed is a failed proxy call.
 * wake is any input after the idle timeout (it ends an idle nap, not the backend's).
 */
export type ClientEvent =
  | { readonly type: "app-open" }
  | { readonly type: "input-focus" }
  | { readonly type: "input-blur" }
  | { readonly type: "send" }
  | { readonly type: "idle-timeout" }
  | { readonly type: "wake" }
  | { readonly type: "backend-down" }
  | { readonly type: "backend-up" }
  | { readonly type: "not-found" }
  | { readonly type: "loading-start" }
  | { readonly type: "loading-end" }
  | { readonly type: "deliverable-added" }
  | { readonly type: "request-failed" }
  | { readonly type: "clip-ended"; readonly state: MascotName };

export type MascotEvent = StreamEvent | ClientEvent;
