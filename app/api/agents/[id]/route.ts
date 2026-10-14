import { type AgentContext, forwardAgent, statusOnly } from "@/lib/server/agents";

// GET: one agent (workspace agents only). PUT: switch it on or off, {status} only; any
// other field is refused here, so Play can't edit an agent (PRD-003 non-goals).

export async function GET(request: Request, context: AgentContext): Promise<Response> {
  return forwardAgent(request, context, { suffix: "" });
}

export async function PUT(request: Request, context: AgentContext): Promise<Response> {
  return forwardAgent(request, context, { suffix: "", jsonBody: true, checkBody: statusOnly });
}
