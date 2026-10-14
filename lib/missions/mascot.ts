import type { MascotName } from "@/lib/mascot/types";
import { isMissionState } from "@/lib/missions/states";
import type { MissionState } from "@/lib/missions/types";

// Auto on a Mission's page follows that Mission only (missions.md, "Mascot"). Pure: the
// page keeps whether he has celebrated, so a completed Mission celebrates once, then idles.

const POSES: Readonly<Record<MissionState, MascotName>> = {
  pending: "thinking",
  planning: "thinking",
  replanning: "thinking",
  running: "working",
  verifying: "working",
  awaiting_approval: "listening",
  awaiting_human: "listening",
  paused: "idle",
  completed: "celebrate",
  failed: "oops",
  cancelled: "idle",
};

const CAPTIONS: Readonly<Record<MissionState, string>> = {
  pending: "Getting ready",
  planning: "Working out a plan",
  replanning: "Working out a new plan",
  running: "The crew is on it",
  verifying: "Checking the work",
  awaiting_approval: "Your plan is ready to look over",
  awaiting_human: "Waiting for a person",
  paused: "Paused",
  completed: "All done",
  failed: "Something went wrong",
  cancelled: "Cancelled",
};

/** Auto's state for this Mission. celebrated: the one celebrate has played. */
export function missionMascot(state: string, celebrated: boolean): MascotName {
  if (!isMissionState(state)) return "idle";
  const pose = POSES[state];
  return pose === "celebrate" && celebrated ? "idle" : pose;
}

/** The line under Auto; a state this build doesn't know gets his idle words. */
export function missionCaption(state: string): string | undefined {
  return isMissionState(state) ? CAPTIONS[state] : undefined;
}
