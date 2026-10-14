// Tasks carry an agent id but no name (missions.md): join them here. Pure.

type Named = { readonly id: number; readonly name: string };

/** id -> name. A blank name is left out, so the caller can fall back to the task's role. */
export function agentNameMap(agents: readonly Named[]): ReadonlyMap<number, string> {
  return new Map(
    agents.filter((agent) => agent.name.trim() !== "").map((agent): [number, string] => [agent.id, agent.name.trim()]),
  );
}
