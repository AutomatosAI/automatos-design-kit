// A browser-wide "the conversation list changed" signal: the chat announces it when a
// turn ends (a new conversation now exists, or one moved to the top), and the
// sidebar's Recent list reloads. A no-op on the server.

const CHATS_CHANGED = "automatos-play:chats-changed";

export function announceChatsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHATS_CHANGED));
}

/** Calls onChange on every announcement; returns the unsubscribe. */
export function onChatsChanged(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(CHATS_CHANGED, onChange);
  return () => window.removeEventListener(CHATS_CHANGED, onChange);
}
