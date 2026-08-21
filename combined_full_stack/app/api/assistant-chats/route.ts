import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { assistantChatCreateBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import {
  createAssistantChat,
  listAssistantChats,
  toStoredAssistantMessages,
  type StoredAssistantChatMessage,
} from "@/lib/server/assistant_chats";
import { requireProjectOr404 } from "@/lib/server/assistant-route";
import { logger } from "@/lib/server/server_logger";
import type { ProjectId } from "@/lib/server/types";

const apiLog = logger("api:assistant-chats");

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId") as ProjectId | null;
  if (!projectId) return apiError("projectId is required", HTTP.BAD_REQUEST);

  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { auth, store } = ctx;

  const projectOrErr = await requireProjectOr404(store, projectId, apiLog);
  if (projectOrErr instanceof NextResponse) return projectOrErr;

  const chats = await listAssistantChats(auth, projectId);
  return NextResponse.json({ chats });
}

export async function POST(req: NextRequest) {
  const parsed = await parseRequestJson(req, assistantChatCreateBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  const { projectId, messages } = parsed;

  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { auth, store } = ctx;

  const projectOrErr = await requireProjectOr404(store, projectId as ProjectId, apiLog);
  if (projectOrErr instanceof NextResponse) return projectOrErr;

  const chat = await createAssistantChat(
    auth,
    projectId as ProjectId,
    toStoredAssistantMessages((messages ?? []) as StoredAssistantChatMessage[]),
  );
  apiLog.info(`POST /api/assistant-chats`, { projectId, chatId: chat.id });
  return NextResponse.json({ chat });
}
