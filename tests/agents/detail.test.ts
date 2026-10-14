// @vitest-environment node
import { describe, expect, it } from "vitest";

import { eventWords, isAutoAgent, jobLine, parseAgentDetail, sessionLine } from "@/lib/agents/detail";
import { NO_TASKS_YET, parsePerformance, performanceFigures } from "@/lib/agents/performance";
import { isAgentId } from "@/lib/agents/types";
import { agentChatHref, agentParam } from "@/lib/chat/params";
import { turnRequest } from "@/lib/chat/turn";

// P-008, pure: one agent read from GET /api/agents/{id}, its performance with the core's
// placeholders dropped, the session line, and the chat address that carries agentId.

const WORKSPACE_ID = "3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10";
const NOW = new Date("2026-10-14T12:00:00Z");

describe("parseAgentDetail", () => {
  it("reads the list row plus team, skills and tools", () => {
    const agent = parseAgentDetail({
      id: 7,
      name: "Researcher Rae",
      job_title: "Analyst",
      team: " Research ",
      status: "active",
      configuration: { runtime: "api" },
      agent_model_config: { provider: "anthropic", model_id: "claude-sonnet-4-5" },
      skills: [{ id: 1, name: "Web research", description: "Finds sources" }, { id: 2, name: " " }, "x"],
      tools: [{ name: "GMAIL", description: "" }, { description: "no name" }],
    });
    expect(agent).toMatchObject({
      id: 7,
      team: "Research",
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      skills: [{ name: "Web research", description: "Finds sources" }],
      tools: [{ name: "GMAIL", description: null }],
    });
  });

  it("gives empty lists when the core leaves them out, and null for no id", () => {
    expect(parseAgentDetail({ id: 3, name: "A" })).toMatchObject({ team: null, skills: [], tools: [] });
    expect(parseAgentDetail({ name: "No id" })).toBeNull();
    expect(parseAgentDetail("x")).toBeNull();
  });
});

describe("agent words", () => {
  it("finds Auto by his slug in this workspace, never by id", () => {
    const auto = parseAgentDetail({ id: 42, name: "Auto", is_system_agent: true, slug: `auto-${WORKSPACE_ID}` });
    const cto = parseAgentDetail({ id: 1, name: "Auto CTO", is_system_agent: true, slug: "auto-cto" });
    expect(auto && isAutoAgent(auto, WORKSPACE_ID)).toBe(true);
    expect(cto && isAutoAgent(cto, WORKSPACE_ID)).toBe(false);
  });

  it("joins the job title and team", () => {
    expect(jobLine({ jobTitle: "Analyst", team: "Research" })).toBe("Analyst · Research team");
    expect(jobLine({ jobTitle: null, team: null })).toBeNull();
  });

  it("takes whole-number ids only", () => {
    expect(isAgentId("7")).toBe(true);
    for (const raw of ["0", "07", "-1", "1.5", "abc", "1/2", "1234567890123"]) expect(isAgentId(raw)).toBe(false);
  });
});

describe("sessionLine", () => {
  it("says provider, model, the live tool and the last event in words", () => {
    const line = sessionLine(
      {
        provider: "claude_code",
        model: "opus",
        liveTool: "Edit",
        lastEvent: "PostToolUse",
        lastEventAt: "2026-10-14T11:58:00Z",
      },
      NOW,
    );
    expect(line).toBe("Claude code · opus · Using Edit · Last event: used a tool, 2 min ago");
  });

  it("keeps what the host sent and is null when it sent nothing", () => {
    const empty = { provider: null, model: null, liveTool: null, lastEvent: null, lastEventAt: null };
    expect(sessionLine({ ...empty, lastEvent: "TerminalOpened" }, NOW)).toBe("Last event: terminal opened");
    expect(sessionLine(empty, NOW)).toBeNull();
  });

  it("splits an event it doesn't know", () => {
    expect(eventWords("PreCompact")).toBe("pre compact");
  });
});

describe("performance", () => {
  const noMetrics = {
    overall_score: 85,
    success_rate: 0,
    average_response_time: 0,
    total_tasks: 0,
    completed_tasks: 0,
    failed_tasks: 0,
    total_tokens_used: 1200,
    total_cost: 0.42,
    total_requests: 3,
    average_memory_usage: 0,
    average_cpu_usage: 0,
    uptime_percentage: 99.8,
  };

  it("hides the task figures while the core has counted no task, and never shows the placeholders", () => {
    const labels = performanceFigures(parsePerformance(noMetrics), "api").map((figure) => figure.label);
    expect(labels).toEqual(["Tokens", "Cost", "Requests"]);
    expect(NO_TASKS_YET).toMatch(/No tasks/);
  });

  it("shows success rate, tasks and response time once there are tasks", () => {
    const figures = performanceFigures(
      parsePerformance({ ...noMetrics, success_rate: 87.5, total_tasks: 8, completed_tasks: 7, failed_tasks: 1, average_response_time: 2.4 }),
      "api",
    );
    expect(figures).toEqual([
      { label: "Success rate", value: "87.5%" },
      { label: "Tasks", value: "8" },
      { label: "Done", value: "7" },
      { label: "Failed", value: "1" },
      { label: "Average response", value: "2.4 s" },
      { label: "Tokens", value: "1,200" },
      { label: "Cost", value: "$0.42" },
      { label: "Requests", value: "3" },
    ]);
  });

  it("never shows dollars for a session agent", () => {
    const cost = performanceFigures(parsePerformance(noMetrics), "session").find((figure) => figure.label === "Cost");
    expect(cost?.value).toBe("On your plan");
  });

  it("reads a body it can't use as zeros", () => {
    expect(parsePerformance(null)).toMatchObject({ totalTasks: 0, totalTokens: 0, successRate: 0 });
  });
});

describe("chatting with an agent", () => {
  it("puts the agent in the address and reads it back", () => {
    expect(agentChatHref(7)).toBe("/?agent=7");
    expect(agentParam({ agent: "7" })).toBe(7);
    expect(agentParam({ agent: "abc" })).toBeUndefined();
    expect(agentParam({ agent: "7", chat: "c1" })).toBeUndefined();
    expect(agentParam({})).toBeUndefined();
  });

  it("sends agentId with the message, and leaves it out for Auto", () => {
    expect(turnRequest("", "hello", 7)).toMatchObject({ id: "", agentId: 7 });
    expect(turnRequest("c1", "hello")).not.toHaveProperty("agentId");
  });
});
