"use client";

// One agent's page (PRD-003 P-008), on the detail page pattern: its name, state and
// runtime, "Chat with <name>", who it is (job title, team, description, its work now),
// a session agent's live session line, its performance, skills and tools, and the
// model route in the side panel. Auto appears only on Auto's own page.

import Link from "next/link";

import { AutoMascot } from "@/components/mascot/AutoMascot";
import { DetailPage } from "@/components/page/DetailPage";
import { PageFailed, PageLoading } from "@/components/page/parts";
import { StateChip } from "@/components/page/StateChip";
import { MascotColumn } from "@/components/shell/PageColumns";
import { useAgentDetail } from "@/hooks/useAgentDetail";
import { autoMascot, autoWorkWords, crewStatus, RUNTIME_LABELS } from "@/lib/agents/crew";
import { type AgentDetail, isAutoAgent } from "@/lib/agents/detail";
import { type FleetAgent, fleetById } from "@/lib/agents/fleet";
import { agentChatHref } from "@/lib/chat/params";
import { api, type ApiClient } from "@/lib/client/api";

import pageStyles from "../page/page.module.css";
import styles from "./agents.module.css";
import { AbilitiesSection, AboutSection, AgentSidePanel, PerformanceSection, SessionSection } from "./AgentDetailSections";

export const BACK = { href: "/agents", label: "Agents" } as const;
export const LOADING_AGENT = "Loading this agent…";
export const PLACEHOLDER_TITLE = "Agent";

/** "Chat with Researcher Rae"; Auto's opens the ordinary chat (he answers when no agent is named). */
export function chatWithLabel(agent: AgentDetail): string {
  return `Chat with ${agent.name.trim() || "this agent"}`;
}

export interface AgentDetailScreenProps {
  readonly id: number;
  /** Tests pass their own (createApiClient with a mock fetch). */
  readonly client?: ApiClient;
  /** What "now" is for "Last active"; tests pin it. */
  readonly now?: Date;
  /** The fleet's poll interval; POLL_INTERVALS.FLEET unless a test wants it faster. */
  readonly fleetIntervalMs?: number;
}

export function AgentDetailScreen({ id, client = api, now, fleetIntervalMs }: AgentDetailScreenProps) {
  const { page, performance, fleet } = useAgentDetail(client, id, fleetIntervalMs);
  if (page.status === "loading") {
    return (
      <DetailPage back={BACK} title={PLACEHOLDER_TITLE}>
        <PageLoading text={LOADING_AGENT} />
      </DetailPage>
    );
  }
  if (page.status === "failed") {
    return (
      <DetailPage back={BACK} title={PLACEHOLDER_TITLE}>
        <PageFailed error={page.error} retry={page.retry} />
      </DetailPage>
    );
  }
  const { agent, workspaceId } = page.value;
  const live = fleetById(fleet.status === "ready" ? fleet.value : null).get(agent.id);
  const isAuto = isAutoAgent(agent, workspaceId);
  const today = now ?? new Date();

  return (
    <DetailPage
      back={BACK}
      title={agent.name.trim() || (isAuto ? "Auto" : "Unnamed agent")}
      chips={
        <>
          <StateChip {...crewStatus(agent, live)} />
          <span className={styles.runtime}>{RUNTIME_LABELS[agent.runtime]}</span>
        </>
      }
      actions={<ChatAction agent={agent} isAuto={isAuto} />}
      side={<AgentSidePanel agent={agent} live={live} now={today} />}
      mascot={isAuto ? <AutoColumn live={live} /> : undefined}
    >
      <AboutSection agent={agent} live={live} />
      {agent.runtime === "session" && <SessionSection live={live} now={today} />}
      <PerformanceSection runtime={agent.runtime} performance={performance} />
      <AbilitiesSection agent={agent} />
    </DetailPage>
  );
}

/** The page's one primary action. A session agent talks in its terminal, so it has none (see AboutSection). */
function ChatAction({ agent, isAuto }: { readonly agent: AgentDetail; readonly isAuto: boolean }) {
  if (agent.runtime === "session") return null;
  return (
    <Link href={isAuto ? "/" : agentChatHref(agent.id)} className={pageStyles.primary}>
      {chatWithLabel(agent)}
    </Link>
  );
}

/** Auto on his own page: working while the fleet says he has something in hand, idle otherwise. */
function AutoColumn({ live }: { readonly live: FleetAgent | undefined }) {
  return (
    <MascotColumn>
      <AutoMascot state={autoMascot(live)} caption={autoWorkWords(live)} />
    </MascotColumn>
  );
}
