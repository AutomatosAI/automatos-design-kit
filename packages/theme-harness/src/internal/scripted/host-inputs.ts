/**
 * PRD-261 B-02c: the host state the fake chat, Deliverables and cards read, taken from the fake core areas by
 * their SDK names (B-02b's src/sdk/context.ts and src/sdk/navigation.ts), so the controls that set them in
 * src/host.ts (the health, the edition, the trial, the workspace, the query string, the router's spy) reach these
 * fakes as well. Not an SDK name. It is the one module of B-02c that reads B-02b, and the one a test of B-02c's
 * fakes replaces (vi.mock) to set those inputs without the host's controls.
 */
export { useEdition, useHealth, useTrial, useWorkspace } from '../../sdk/context.ts'
export { CHAT_HREF, useHostRouter, useHostSearchParams } from '../../sdk/navigation.ts'
