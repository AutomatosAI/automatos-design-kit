---
name: build-automatos-interface
description: Build a separate web interface on a local (open-source) Automatos install — chat with Auto over the streaming API, show Deliverables, and drive the Auto mascot from real stream events. Use when asked to build, extend or debug a UI that talks to the Automatos API from outside the core repo.
---

# Build an Automatos interface

Automatos is a headless OS: the backend (`automatos-ai/orchestrator`, FastAPI) does the work and any web page can be its interface. Studio is the default one. This skill builds another one, in its own repo, without changing the core.

**Scope of this version: the local edition only** (`AUTH_EDITION=local`, `docker compose up`, no accounts). The hosted edition needs a login and is not covered here.

## When to use

- Building or extending `automatos-play` (the fun UI) or any other UI that lives outside `automatos-ai`.
- Wiring the Auto mascot to what Auto is actually doing.
- Debugging a stream that renders wrong in an outside UI.

Don't use it for changes inside `automatos-ai/frontend` (Studio). That repo has its own rules in its `AGENTS.md`.

## The shape (read this first)

```
browser ──► your UI's own server routes (/api/*) ──► Automatos backend (http://localhost:8000)
            same origin: no CORS, no secrets in the page
```

1. **Proxy, never call the backend from the browser.** Copy the pattern Studio uses in `automatos-ai/frontend/app/api/chat/route.ts`: a server route that forwards the request body and the `X-Workspace-ID` header and passes the response body straight through, so streaming survives. The backend's CORS list (`CORS_ALLOW_ORIGINS`, default `http://localhost:3000`) does not include your UI, and it shouldn't need to.
2. **No login in the local edition.** `REQUIRE_AUTH` is forced off when `AUTH_EDITION=local` (`orchestrator/config.py:204-209`). A request with no credentials becomes the local operator as super admin (`orchestrator/core/auth/hybrid.py:1003-1026`). Send no `Authorization` header.
3. **Workspace.** Call `GET /api/workspaces/current` once, keep the `id`, and send it as `X-Workspace-ID` on every request. Without it the backend falls back to `DEFAULT_WORKSPACE_ID` and returns 400 if that is unset.
4. **Backend URL is config.** `AUTOMATOS_BACKEND_URL` on the server side: `http://localhost:8000` when the UI runs on the host, `http://backend:8000` when it runs in a container on the `automatos_network` Docker network (named in `automatos-ai/docker-compose.yml`).

Never use `ORCHESTRATOR_API_KEY`. It is one admin key for the whole install, and the local edition doesn't need it. Workspace SDK keys (`ak_pub_*`, `ak_srv_*`) only work on `/api/widgets/*`, not on the chat, Mission or Deliverable routes this UI uses.

## Build steps

1. **Read the references** for the part you are building:
   - `references/chat-stream.md`: the chat request and the line-by-line stream format, with every event type.
   - `references/endpoints.md`: workspace, conversations, Deliverables, cancel.
   - `references/mascot-states.md`: how stream events choose the mascot animation, and the switching rules.
2. **Proxy routes first:** `/api/chat` (streaming), then plain JSON pass-throughs for the other endpoints you use. Forward the method, query string, JSON body and `X-Workspace-ID`. Return the backend status code unchanged.
3. **Stream parser second**, as a pure function from lines to typed events, with unit tests over recorded fixtures. Studio's parser in `automatos-ai/frontend/lib/chat/hooks.ts:296-560` is the reference. It handles two line formats; see the stream reference.
4. **Mascot state machine third**, as a pure reducer from events to state. Test it with the same fixtures.
5. **UI last.** The assets are in `public/auto/` (see the mascot reference for the file names).

## Rules

- The proxy routes are the only place that knows the backend URL. Components call your own `/api/*`.
- Treat every stream line as untrusted input: parse inside `try`, skip lines you don't understand, never `eval`, render text as text (no `dangerouslySetInnerHTML` on model output).
- Unknown `d:` event types are normal, because the backend adds new ones. Ignore them without breaking the stream.
- Use the canonical words in UI copy: **Auto** (a name, not "the assistant"), **Mission**, **Deliverable** (not "output" or "file"), **Playbook**.
- One request at a time per conversation. Cancel with `POST /api/chat/{chat_id}/cancel` before sending again.

## Known gaps in the core (don't work around them silently)

These are real limits of the backend today. If your UI needs one, raise it with the maintainer instead of patching around it in the UI.

- No scoped key for outside apps on the chat, Mission and Deliverable routes, so the hosted edition is out of scope.
- The stream event names in `consumers/chatbot/streaming.py` and the typed enum in `core/models/stream_events.py` don't match. Code against the strings in `references/chat-stream.md`.
- No `searching` event: a web search is an ordinary `tool-start`, so the mascot reference matches on tool names.
- No binary download for Deliverables: `GET /api/deliverables/{id}?include_content=true` returns the content inline.
- A Mission proposed in chat arrives as a `mission-suggestion` event. It isn't created until something calls `POST /api/missions`.

## Verify

- Unit tests: the parser over recorded fixtures, and the mascot reducer over event sequences.
- A run against a local install (`docker compose up` in `automatos-ai`): send "hello", see text stream in, see the mascot go thinking → idle, see the conversation appear in `GET /api/chat/history`.
- Never report a check as passed without having seen it pass.
