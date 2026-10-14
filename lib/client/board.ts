import { failure, type Transport } from "@/lib/client/transport";

// The board's calls (board-analytics.md), through Play's /api/tasks routes. The list,
// the Task and its moves come with the Board (B-003); this is the live stream.

const STREAM_PATH = "/api/tasks/stream";

export function boardEndpoints({ call }: Transport) {
  return {
    /** The live board stream, open; the caller reads response.body (lib/board/live.ts). */
    async openBoardStream(signal?: AbortSignal): Promise<Response> {
      const response = await call(STREAM_PATH, { signal });
      if (!response.ok) throw await failure(response, STREAM_PATH);
      return response;
    },
  };
}
