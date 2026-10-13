# Skill gaps

Where `skills/build-automatos-interface/` or the mocks were wrong, missing or unclear during the pilot build, and what was done. The core wins: the skill is fixed to match it.

| Story | Gap | What was done |
|---|---|---|
| US-004 | `endpoints.md` said `GET /api/deliverables/{id}` returns "one Deliverable". It returns `{success, deliverable}` and 404s a missing id (`api/deliverables.py:108-128`). | Skill fixed. `lib/client/api.ts` `getDeliverable` unwraps `deliverable`. |
| US-004 | `endpoints.md` didn't say `preview_url` / `content_url` are backend-relative paths (`/api/workspaces/{ws}/files/raw?path=…`) for workspace files, so the browser can't load them. | Skill fixed. Play has no proxy for workspace files yet: US-012 must either add one (`/api/workspaces/[ws]/files/raw` through `forwardToBackend`) or treat those URLs as unavailable. |
| US-004 | An `<img src>` can't send `X-Workspace-ID`, so the thumbnail route can't be used as a plain image URL. | `api.deliverableThumbnail(id)` fetches the bytes with the header and returns a Blob (null on 404); the card makes an object URL. |
| US-004 | The skill says the backend falls back to `DEFAULT_WORKSPACE_ID` without `X-Workspace-ID`; it doesn't say it reads `?workspace_id=` first (`core/auth/hybrid.py:77`). | The proxy forwards only the query keys each route allows (`ForwardOptions.query`), so a stray `workspace_id` never reaches the backend. |
