import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatScreen } from "@/components/chat/ChatScreen";
import {
  NOT_NOW,
  START_SUGGESTED,
  SUGGESTION_FAILED,
  SUGGESTION_LABEL,
} from "@/components/chat/MissionSuggestionCard";
import { createApiClient } from "@/lib/client/api";
import { HELLO_KEY } from "@/lib/mascot/session";

import { callsTo, type ChatAnswer, FIXTURE_CHAT_ID, fixtureAnswer, hangingAnswer, mockChatFetch, type Routes } from "./helpers";

// P-006: a mission-suggestion frame in a chat turn becomes a card under Auto's answer.
// Start this Mission sends the documented body (missions.md) and opens the new Mission.

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/",
}));

/** The goal in tests/fixtures/mission-suggestion.txt: the backend sends the user's own message. */
const GOAL = "Research three electric bike makers and write a comparison report";
const ANSWER = "That's a few steps of work. I can start it as a Mission, so the crew researches and I check the report.";
const MISSION_ID = "5d2e8f1a-9c4b-4e7d-8a36-2f1b0c9d7e54";

const created: Routes = {
  "/api/missions": () => Response.json({ id: MISSION_ID, goal: GOAL, state: "planning" }, { status: 201 }),
};

function renderChat(answers: readonly ChatAnswer[], routes: Routes = created) {
  const fetchMock = mockChatFetch(answers, routes);
  const user = userEvent.setup();
  render(<ChatScreen client={createApiClient(fetchMock)} />);
  return { fetchMock, user, box: screen.getByRole("textbox", { name: "Message Auto" }) };
}

async function askForTheMission() {
  const view = renderChat([fixtureAnswer("mission-suggestion")]);
  await view.user.type(view.box, `${GOAL}{Enter}`);
  await screen.findByRole("button", { name: "Send" });
  return view;
}

function sentBody(init: RequestInit): unknown {
  return JSON.parse(String(init.body));
}

beforeEach(() => {
  window.sessionStorage.setItem(HELLO_KEY, "1");
  push.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a Mission Auto suggests in chat", () => {
  it("shows a card under Auto's answer with the goal and its complexity", async () => {
    await askForTheMission();
    const reply = screen.getByRole("article", { name: "Auto said" });
    const card = within(reply).getByRole("region", { name: SUGGESTION_LABEL });
    expect(within(card).getByText(GOAL)).toBeInTheDocument();
    expect(within(card).getByText("Multi-step")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: START_SUGGESTED })).toBeEnabled();
    expect(within(card).getByRole("button", { name: NOT_NOW })).toBeEnabled();
    expect(within(reply).getByText(ANSWER)).toBeInTheDocument();
  });

  it("Start this Mission sends the documented body, then opens the new Mission", async () => {
    const { user, fetchMock } = await askForTheMission();
    await user.click(screen.getByRole("button", { name: START_SUGGESTED }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/missions/${MISSION_ID}`));

    const posts = callsTo(fetchMock, "/api/missions");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.method).toBe("POST");
    expect(sentBody(posts[0] ?? {})).toEqual({
      goal: GOAL,
      config: {
        source: "chat",
        chat_id: FIXTURE_CHAT_ID,
        context_messages: [
          { role: "user", content: GOAL },
          { role: "assistant", content: ANSWER },
        ],
      },
    });
  });

  it("Not now hides the card for that message and creates nothing", async () => {
    const { user, fetchMock } = await askForTheMission();
    await user.click(screen.getByRole("button", { name: NOT_NOW }));
    expect(screen.queryByRole("region", { name: SUGGESTION_LABEL })).not.toBeInTheDocument();
    expect(screen.getByText(ANSWER)).toBeInTheDocument();
    expect(callsTo(fetchMock, "/api/missions")).toHaveLength(0);
    expect(push).not.toHaveBeenCalled();
  });

  it("says so in words when the Mission can't start, and stays on the chat", async () => {
    const refused: Routes = {
      "/api/missions": () => Response.json({ detail: "goal is too long" }, { status: 422 }),
    };
    const view = renderChat([fixtureAnswer("mission-suggestion")], refused);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await view.user.type(view.box, `${GOAL}{Enter}`);
    await view.user.click(await screen.findByRole("button", { name: START_SUGGESTED }));
    const card = screen.getByRole("region", { name: SUGGESTION_LABEL });
    expect(await within(card).findByRole("alert")).toHaveTextContent(`${SUGGESTION_FAILED} goal is too long`);
    expect(error).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: START_SUGGESTED })).toBeEnabled();
  });

  it("waits for Auto's answer to end before offering the Mission", async () => {
    const suggestion = `d:{"type": "mission-suggestion", "data": {"goal": "${GOAL}", "complexity": "organism", "agent_id": 1}}`;
    const { user, box } = renderChat([
      hangingAnswer([suggestion, `d:{"type":"chat-id","chatId":"chat-9"}`, `0:"Thinking it through."`]),
    ]);
    await user.type(box, `${GOAL}{Enter}`);
    expect(await screen.findByText("Thinking it through.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: SUGGESTION_LABEL })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Stop" }));
    const card = await screen.findByRole("region", { name: SUGGESTION_LABEL });
    expect(within(card).getByText("Complex, several agents")).toBeInTheDocument();
    await screen.findByRole("button", { name: "Send" });
  });

  it("a turn without a suggestion shows no card", async () => {
    const { user, box } = renderChat([fixtureAnswer("plain-answer")]);
    await user.type(box, "hello{Enter}");
    await screen.findByRole("button", { name: "Send" });
    expect(screen.queryByRole("region", { name: SUGGESTION_LABEL })).not.toBeInTheDocument();
  });
});
