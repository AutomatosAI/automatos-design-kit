// The conversation list (mock 03) as pure data: groups by day, relative times, the
// preview line and the title search. Dates are the user's local calendar days.

import type { ChatSummary } from "@/lib/client/types";

export type GroupLabel = "Today" | "This week" | "Earlier";

export type ConversationGroup = {
  readonly label: GroupLabel;
  readonly chats: readonly ChatSummary[];
};

export const UNTITLED_CHAT = "New chat";
/** Who wrote the history's preview. The core doesn't say (docs/SKILL-GAPS.md, US-010). */
export const PREVIEW_SPEAKER = "Auto";

const GROUP_ORDER: readonly GroupLabel[] = ["Today", "This week", "Earlier"];
/** "This week" is the six days before today. */
const WEEK_DAYS = 7;
const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;
const LOCALE = "en-GB";

const weekday = new Intl.DateTimeFormat(LOCALE, { weekday: "short" });
const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });
const dayMonthYear = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" });

function parseDate(iso: string | null): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** When the conversation last moved: the history is ordered by updatedAt. */
export function lastActive(chat: ChatSummary): Date | null {
  return parseDate(chat.updatedAt) ?? parseDate(chat.createdAt);
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Whole calendar days from date to now: 0 today, 1 yesterday; negative in the future. */
function daysAgo(date: Date, now: Date): number {
  return Math.round((startOfDay(now) - startOfDay(date)) / (24 * HOUR_MINUTES * MINUTE_MS));
}

export function groupOf(date: Date | null, now: Date): GroupLabel {
  if (!date) return "Earlier";
  const days = daysAgo(date, now);
  if (days <= 0) return "Today";
  return days < WEEK_DAYS ? "This week" : "Earlier";
}

/** Groups in mock order, empty ones left out; the history's own order is kept inside each. */
export function groupConversations(chats: readonly ChatSummary[], now: Date): readonly ConversationGroup[] {
  return GROUP_ORDER.map((label) => ({
    label,
    chats: chats.filter((chat) => groupOf(lastActive(chat), now) === label),
  })).filter((group) => group.chats.length > 0);
}

function sameDayTime(date: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / MINUTE_MS));
  if (minutes < 1) return "Just now";
  if (minutes < HOUR_MINUTES) return `${minutes} min`;
  return `${Math.floor(minutes / HOUR_MINUTES)} h`;
}

/** "2 min", "3 h", "Yesterday", "Mon", "9 Oct" (with the year when it isn't this one); "" when unknown. */
export function relativeTime(date: Date | null, now: Date): string {
  if (!date) return "";
  const days = daysAgo(date, now);
  if (days <= 0) return sameDayTime(date, now);
  if (days === 1) return "Yesterday";
  if (days < WEEK_DAYS) return weekday.format(date);
  return date.getFullYear() === now.getFullYear() ? dayMonth.format(date) : dayMonthYear.format(date);
}

export function conversationTitle(chat: ChatSummary): string {
  return chat.title.replace(/\s+/g, " ").trim() || UNTITLED_CHAT;
}

/** "Auto: …", or null when the conversation has no messages yet. */
export function previewLine(chat: ChatSummary): string | null {
  const preview = chat.lastMessagePreview?.replace(/\s+/g, " ").trim();
  return preview ? `${PREVIEW_SPEAKER}: ${preview}` : null;
}

/** Case-insensitive match on the title; an empty query keeps everything. */
export function filterByTitle(chats: readonly ChatSummary[], query: string): readonly ChatSummary[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return chats;
  return chats.filter((chat) => conversationTitle(chat).toLocaleLowerCase().includes(needle));
}
