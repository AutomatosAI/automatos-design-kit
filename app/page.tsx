import { ChatScreen } from "@/components/chat/ChatScreen";
import { chatParam, draftParam, type SearchParams } from "@/lib/chat/params";

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const chatId = chatParam(params);
  const draft = draftParam(params);
  // A new key per conversation (and per draft): going from one to another, or to a new chat, starts fresh.
  return <ChatScreen key={chatId ?? `new:${draft ?? ""}`} chatId={chatId} draft={draft} />;
}
