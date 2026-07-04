import { NextResponse } from "next/server";
import { enforceUserRateLimit } from "@/lib/server/api_context";
import { isAuthSession, requireAuth } from "@/lib/server/require_auth";
import {
  PROJECT_TEMPLATE_STREAM_EVENT,
  projectTemplateSummaryFromFile,
  seedJsonFilenames,
} from "@/lib/server/seed";

// AI : auth only — do not hydrate the store (ensureSeedDocs blocks on every bundled example).
export async function GET() {
  const auth = await requireAuth();
  if (!isAuthSession(auth)) return auth;
  const limited = await enforceUserRateLimit(auth.userId, "default");
  if (limited) return limited;

  const encoder = new TextEncoder();
  const bodyStream = new ReadableStream({
    async start(controller) {
      const push = (payload: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };
      try {
        for (const filename of seedJsonFilenames()) {
          push({
            type: PROJECT_TEMPLATE_STREAM_EVENT.TEMPLATE,
            template: projectTemplateSummaryFromFile(filename),
          });
        }
        push({ type: PROJECT_TEMPLATE_STREAM_EVENT.DONE });
      } catch (err) {
        push({
          type: PROJECT_TEMPLATE_STREAM_EVENT.ERROR,
          error: (err as Error).message,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(bodyStream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
