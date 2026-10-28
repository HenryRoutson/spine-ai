import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { assistantChatSaveBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import {
  deleteAssistantChat,
  getAssistantChat,
  saveAssistantChatMessages,
  toStoredAssistantMessages,
  type StoredAssistantChatMessage,
  type assistant_chat_id_string,
} from "@/lib/server/assistant_chats";
import { logger } from "@/lib/server/server_logger";

const apiLog = logger("api:assistant-chats");

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;

  const chat = await getAssistantChat(authCtx.auth, id as assistant_chat_id_string);
  if (!chat) return apiError("Chat not found", HTTP.NOT_FOUND);
  return NextResponse.json({ chat });
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const parsed = await parseRequestJson(req, assistantChatSaveBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);

  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;

  const chat = await saveAssistantChatMessages(
    authCtx.auth,
    id as assistant_chat_id_string,
    toStoredAssistantMessages(parsed.messages as StoredAssistantChatMessage[]),
  );
  if (!chat) return apiError("Chat not found", HTTP.NOT_FOUND);

  apiLog.info(`PUT /api/assistant-chats/${id}`, { messageCount: chat.messageCount });
  return NextResponse.json({ chat });
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;

  const deleted = await deleteAssistantChat(authCtx.auth, id as assistant_chat_id_string);
  if (!deleted) return apiError("Chat not found", HTTP.NOT_FOUND);

  apiLog.info(`DELETE /api/assistant-chats/${id}`);
  return NextResponse.json({ ok: true });
}
