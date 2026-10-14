// The sections of an agent's page (P-008): who it is, a session agent's live session,
// its performance, its skills and tools, and the side panel (model route, recent
// activity). Words come from lib/agents/; the performance placeholders are dropped in
// lib/agents/performance.ts, never shown as 0.

import type { ReactNode } from "react";

import type { Loaded } from "@/hooks/useLoad";
import { costLine, lastActiveLine, modelRoute, providerWords, RUNTIME_LABELS, workLine } from "@/lib/agents/crew";
import { type AgentAbility, type AgentDetail, jobLine, NO_SESSION, sessionLine } from "@/lib/agents/detail";
import type { FleetAgent } from "@/lib/agents/fleet";
import { type AgentPerformance, NO_TASKS_YET, performanceFigures } from "@/lib/agents/performance";
import type { AgentRuntime } from "@/lib/agents/types";

import pageStyles from "../page/page.module.css";
import styles from "./agents.module.css";

export const ABOUT = "About";
export const LIVE_SESSION = "Live session";
export const PERFORMANCE = "Performance";
export const SKILLS = "Skills";
export const TOOLS = "Tools";
export const MODEL = "Model";
export const ACTIVITY = "Activity";
export const NO_SKILLS = "No skills yet.";
export const NO_TOOLS = "No tools yet.";
export const NOT_SET = "Not set";
export const LOADING_PERFORMANCE = "Loading performance…";

/** Why a session agent has no "Chat with" button: the core answers chat to it with an error. */
export function sessionChatNote(name: string): string {
  return `${name.trim() || "This agent"} runs in a terminal session, so chat can't reach it. Give it a Task on the board instead.`;
}

interface SectionProps {
  readonly label: string;
  readonly children: ReactNode;
}

function Section({ label, children }: SectionProps) {
  return (
    <section className={styles.section} aria-label={label}>
      <h2 className={pageStyles.sectionLabel}>{label}</h2>
      {children}
    </section>
  );
}

export function AboutSection({ agent, live }: { readonly agent: AgentDetail; readonly live: FleetAgent | undefined }) {
  const job = jobLine(agent);
  const work = workLine(live);
  return (
    <Section label={ABOUT}>
      {job && <p className={styles.role}>{job}</p>}
      {agent.description && <p className={styles.about}>{agent.description}</p>}
      {work && <p className={styles.work}>{work}</p>}
      {agent.unavailable && <p className={styles.note}>{agent.unavailable}</p>}
      {agent.runtime === "session" && <p className={styles.note}>{sessionChatNote(agent.name)}</p>}
    </Section>
  );
}

export interface SessionSectionProps {
  readonly live: FleetAgent | undefined;
  readonly now: Date;
}

/** Provider, model, the tool in use and the last event, from the fleet's session block. */
export function SessionSection({ live, now }: SessionSectionProps) {
  const line = live?.session ? sessionLine(live.session, now) : null;
  return (
    <Section label={LIVE_SESSION}>
      <p className={line ? styles.work : styles.note}>{line ?? NO_SESSION}</p>
    </Section>
  );
}

export interface PerformanceSectionProps {
  readonly runtime: AgentRuntime;
  readonly performance: Loaded<AgentPerformance>;
}

export function PerformanceSection({ runtime, performance }: PerformanceSectionProps) {
  return (
    <Section label={PERFORMANCE}>
      {performance.status === "loading" && <p className={styles.note}>{LOADING_PERFORMANCE}</p>}
      {performance.status === "failed" && (
        <>
          <p className={styles.alert}>{performance.error}</p>
          <button type="button" className={pageStyles.secondary} onClick={performance.retry}>
            Try again
          </button>
        </>
      )}
      {performance.status === "ready" && <Figures performance={performance.value} runtime={runtime} />}
    </Section>
  );
}

function Figures({ performance, runtime }: { readonly performance: AgentPerformance; readonly runtime: AgentRuntime }) {
  return (
    <>
      {performance.totalTasks <= 0 && <p className={styles.note}>{NO_TASKS_YET}</p>}
      <dl className={styles.figures}>
        {performanceFigures(performance, runtime).map((figure) => (
          <div key={figure.label} className={styles.figure}>
            <dt className={styles.figureLabel}>{figure.label}</dt>
            <dd className={styles.figureValue}>{figure.value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

export function AbilitiesSection({ agent }: { readonly agent: AgentDetail }) {
  return (
    <>
      <Section label={SKILLS}>
        {agent.skills.length === 0 ? (
          <p className={styles.note}>{NO_SKILLS}</p>
        ) : (
          <ul className={styles.skillChips} aria-label={SKILLS}>
            {agent.skills.map((skill, index) => (
              <li key={`${skill.name}-${index}`} className={styles.skillChip}>
                {skill.name}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section label={TOOLS}>
        {agent.tools.length === 0 ? <p className={styles.note}>{NO_TOOLS}</p> : <ToolList tools={agent.tools} />}
      </Section>
    </>
  );
}

function ToolList({ tools }: { readonly tools: readonly AgentAbility[] }) {
  return (
    <ul className={styles.toolList} aria-label={TOOLS}>
      {tools.map((tool, index) => (
        <li key={`${tool.name}-${index}`} className={styles.toolItem}>
          <span className={styles.toolName}>{tool.name}</span>
          {tool.description && <span className={styles.note}>{tool.description}</span>}
        </li>
      ))}
    </ul>
  );
}

export interface AgentSidePanelProps {
  readonly agent: AgentDetail;
  readonly live: FleetAgent | undefined;
  readonly now: Date;
}

/** The model route (runtime, provider, model) and the last 24 h from the fleet. */
export function AgentSidePanel({ agent, live, now }: AgentSidePanelProps) {
  const activity = [lastActiveLine(live, now), costLine(agent.runtime, live?.cost24h)].filter(
    (line): line is string => Boolean(line),
  );
  return (
    <>
      <Section label={MODEL}>
        <dl className={styles.facts}>
          <Fact label="Runtime" value={RUNTIME_LABELS[agent.runtime]} />
          <Fact label="Provider" value={agent.provider ? providerWords(agent.provider) : NOT_SET} />
          <Fact label="Model" value={agent.model ?? NOT_SET} />
        </dl>
        {!modelRoute(agent) && <p className={styles.note}>Its model is set in Studio.</p>}
      </Section>
      {activity.length > 0 && (
        <Section label={ACTIVITY}>
          {activity.map((line) => (
            <p key={line} className={styles.meta}>
              {line}
            </p>
          ))}
        </Section>
      )}
    </>
  );
}

function Fact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={styles.factValue}>{value}</dd>
    </>
  );
}
