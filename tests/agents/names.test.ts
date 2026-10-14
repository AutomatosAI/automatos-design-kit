import { describe, expect, it } from "vitest";
import { agentNameMap } from "@/lib/agents/names";
import { parseAgentList } from "@/lib/agents/types";

describe("agentNameMap", () => {
  it("maps each agent's id to its name", () => {
    const names = agentNameMap([
      { id: 1, name: "Auto" },
      { id: 7, name: " Researcher " },
    ]);

    expect(names.get(1)).toBe("Auto");
    expect(names.get(7)).toBe("Researcher");
    expect(names.get(9)).toBeUndefined();
  });

  it("leaves out blank names so the caller can fall back to the task's role", () => {
    expect(agentNameMap([{ id: 3, name: "  " }]).has(3)).toBe(false);
  });

  it("joins the parsed agents list, dropping rows without an integer id", () => {
    const agents = parseAgentList([
      { id: 4, name: "Writer", slug: "writer", status: "active", is_system_agent: false },
      { id: "x", name: "Broken" },
      { name: "No id" },
      { id: 2, name: "Auto", slug: "auto-ws", is_system_agent: true },
    ]);

    expect(agents.map((agent) => agent.id)).toEqual([4, 2]);
    expect(agents[1]?.isSystemAgent).toBe(true);
    expect([...agentNameMap(agents)]).toEqual([
      [4, "Writer"],
      [2, "Auto"],
    ]);
  });

  it("reads anything but a list as no agents", () => {
    expect(parseAgentList({ agents: [] })).toEqual([]);
  });
});
