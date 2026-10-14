import { type AgentContext, forwardAgent } from "@/lib/server/agents";

// Success rate, tasks, tokens and cost; some fields are placeholders that read 0.

export async function GET(request: Request, context: AgentContext): Promise<Response> {
  return forwardAgent(request, context, { suffix: "/performance", query: ["period"] });
}
