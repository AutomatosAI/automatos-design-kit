import { ChatScreen } from "@/components/chat/ChatScreen";
import { chatParam, type SearchParams } from "@/lib/chat/params";

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const chatId = chatParam(await searchParams);
  // A new key per conversation: going from one to another (or to a new chat) starts fresh.
  return <ChatScreen key={chatId ?? "new"} chatId={chatId} />;
}
