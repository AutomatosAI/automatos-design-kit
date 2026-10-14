import { ChatScreen } from "@/components/chat/ChatScreen";
import { agentParam, chatParam, draftParam, type SearchParams } from "@/lib/chat/params";

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const chatId = chatParam(params);
  const draft = draftParam(params);
  const agentId = agentParam(params);
  // A new key per conversation (and per draft or agent): going from one to another, or to a new chat, starts fresh.
  return (
    <ChatScreen
      key={chatId ?? `new:${agentId ?? "auto"}:${draft ?? ""}`}
      chatId={chatId}
      draft={draft}
      agentId={agentId}
    />
  );
}
