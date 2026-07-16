// AI : read NDJSON diagnosis assistant stream.

import { DIAGNOSIS_STREAM_EVENT } from "@/lib/diagnosis-stream-events";

export type DiagnosisStreamResult = {
  text: string;
  usageCents: number;
};

export async function readDiagnosisStream(
  res: Response,
  onDelta?: (delta: string) => void,
): Promise<DiagnosisStreamResult> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("empty response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let result: DiagnosisStreamResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const evt = JSON.parse(line) as Record<string, unknown> & { type: string };
      if (evt.type === DIAGNOSIS_STREAM_EVENT.DELTA && typeof evt.text === "string") {
        onDelta?.(evt.text);
      }
      if (evt.type === DIAGNOSIS_STREAM_EVENT.ERROR) {
        throw new Error(typeof evt.error === "string" ? evt.error : "Diagnosis failed");
      }
      if (evt.type === DIAGNOSIS_STREAM_EVENT.DONE) {
        result = {
          text: typeof evt.text === "string" ? evt.text : "",
          usageCents: typeof evt.usageCents === "number" ? evt.usageCents : 0,
        };
      }
    }
  }

  if (!result) throw new Error("Diagnosis stream ended without result");
  return result;
}
