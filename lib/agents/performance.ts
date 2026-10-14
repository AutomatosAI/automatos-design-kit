import type { AgentRuntime } from "@/lib/agents/types";
import { count, isRecord } from "@/lib/client/types";

// GET /api/agents/{id}/performance (agents-playbooks.md), read into the figures the agent
// page shows. The core builds the answer in orchestrator/api/agent_endpoints.py
// (get_agent_performance), and several of its numbers are not measured:
// - average_memory_usage and average_cpu_usage are always 0 ("PLACEHOLDER - not
//   tracking real CPU/Memory yet"), and uptime_percentage is 99.8 or 0 from the runtime
//   status, not measured either. Play never reads them.
// - overall_score is 85 when the agent has no performance_metrics. Play never reads it.
// - success_rate, completed_tasks, failed_tasks and average_response_time are 0 when the
//   agent has no performance_metrics. Play shows them only once total_tasks is above 0,
//   and the response time only when it is above 0.
// - total_tokens_used, total_cost and total_requests come from model_usage_stats, which
//   the core really counts, so a 0 there is a real 0 and is shown.

export type AgentPerformance = {
  /** 0-100 (the core sends a percentage, not 0-1). */
  readonly successRate: number;
  readonly totalTasks: number;
  readonly completedTasks: number;
  readonly failedTasks: number;
  /** Seconds. */
  readonly averageResponseSeconds: number;
  readonly totalTokens: number;
  /** US dollars. */
  readonly totalCost: number;
  readonly totalRequests: number;
};

function nonNegative(value: unknown): number {
  return Math.max(0, count(value, 0));
}

export function parsePerformance(value: unknown): AgentPerformance {
  const body: Readonly<Record<string, unknown>> = isRecord(value) ? value : {};
  return {
    successRate: Math.min(100, nonNegative(body.success_rate)),
    totalTasks: nonNegative(body.total_tasks),
    completedTasks: nonNegative(body.completed_tasks),
    failedTasks: nonNegative(body.failed_tasks),
    averageResponseSeconds: nonNegative(body.average_response_time),
    totalTokens: nonNegative(body.total_tokens_used),
    totalCost: nonNegative(body.total_cost),
    totalRequests: nonNegative(body.total_requests),
  };
}

export type PerformanceFigure = { readonly label: string; readonly value: string };

export const NO_TASKS_YET = "No tasks recorded yet.";

const numbers = new Intl.NumberFormat("en-GB");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const seconds = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

/** The task figures, only once the core has counted a task (else they are placeholder zeros). */
function taskFigures(perf: AgentPerformance): readonly PerformanceFigure[] {
  if (perf.totalTasks <= 0) return [];
  return [
    { label: "Success rate", value: `${percent.format(perf.successRate)}%` },
    { label: "Tasks", value: numbers.format(perf.totalTasks) },
    { label: "Done", value: numbers.format(perf.completedTasks) },
    { label: "Failed", value: numbers.format(perf.failedTasks) },
  ];
}

/**
 * What the page shows, in order. A session agent runs on the person's own plan, so it
 * shows tokens and never dollars (as on its crew card); an API agent shows its cost.
 */
export function performanceFigures(perf: AgentPerformance, runtime: AgentRuntime): readonly PerformanceFigure[] {
  const response =
    perf.totalTasks > 0 && perf.averageResponseSeconds > 0
      ? [{ label: "Average response", value: `${seconds.format(perf.averageResponseSeconds)} s` }]
      : [];
  const cost =
    runtime === "session"
      ? [{ label: "Cost", value: "On your plan" }]
      : [{ label: "Cost", value: money.format(perf.totalCost) }];
  return [
    ...taskFigures(perf),
    ...response,
    { label: "Tokens", value: numbers.format(perf.totalTokens) },
    ...cost,
    { label: "Requests", value: numbers.format(perf.totalRequests) },
  ];
}
