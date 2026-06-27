import {
  ASSISTANT_REQUEST_FAILED,
  ASSISTANT_STREAM_EVENT,
} from "@/lib/assistant-chat-types";

export async function readPipelineAssistantStream<TProposal>(
  res: Response,
  onRetrying?: () => void,
): Promise<{
  message: string;
  proposal?: TProposal;
  invalidCount: number;
  retryCount: number;
}> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("empty response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let result: {
    message: string;
    proposal?: TProposal;
    invalidCount: number;
    retryCount: number;
  } | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const evt = JSON.parse(line) as {
        type: string;
        attempt?: number;
        error?: string;
        message?: string;
        proposal?: TProposal;
        invalidCount?: number;
        retryCount?: number;
      };
      if (evt.type === ASSISTANT_STREAM_EVENT.RETRYING) onRetrying?.();
      if (evt.type === ASSISTANT_STREAM_EVENT.ERROR) throw new Error(evt.error ?? ASSISTANT_REQUEST_FAILED);
      if (evt.type === ASSISTANT_STREAM_EVENT.DONE) {
        result = {
          message: evt.message ?? "",
          proposal: evt.proposal ?? undefined,
          invalidCount: evt.invalidCount ?? 0,
          retryCount: evt.retryCount ?? 0,
        };
      }
    }
  }

  if (!result) throw new Error("Assistant stream ended without a result");
  return result;
}
