// One Mission in the list: its state as words, the goal (two lines), the bar when the
// backend counted the tasks, and how old it is and what it has used. The card opens it.

import Link from "next/link";

import { ProgressBar } from "@/components/page/parts";
import { StateChip } from "@/components/page/StateChip";
import { cardProgress, goalPreview, missionAge, missionHref, tokensLine } from "@/lib/missions/list";
import { stateChip } from "@/lib/missions/states";
import type { Mission } from "@/lib/missions/types";

import styles from "./missions.module.css";

export interface MissionCardProps {
  readonly mission: Mission;
  readonly now: Date;
}

export function MissionCard({ mission, now }: MissionCardProps) {
  const progress = cardProgress(mission.taskProgress);
  const meta = [missionAge(mission.createdAt, now), tokensLine(mission.tokensUsed)].filter(Boolean).join(" · ");
  return (
    <li className={styles.item}>
      <Link href={missionHref(mission.id)} className={styles.card}>
        <div className={styles.chipRow}>
          <StateChip {...stateChip(mission.state)} />
        </div>
        <h2 className={styles.goal}>{goalPreview(mission.goal)}</h2>
        {progress && <ProgressBar {...progress} />}
        {meta && <p className={styles.meta}>{meta}</p>}
      </Link>
    </li>
  );
}
