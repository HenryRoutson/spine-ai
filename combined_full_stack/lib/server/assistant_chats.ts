import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@/utils/supabase/server";
import { uid } from "../id";
import { dataDir } from "./config";
import { LOCAL_DEV_USER_ID, type AuthSession, type user_id_string } from "./require_auth";
import { emailsForUserIds } from "./teams";
import type { ProjectId } from "./types";

import type { AssistantDebugEntry } from "@/lib/assistant-debug-types";
import type { UiContextRef } from "@/lib/ui-context-types";

export type assistant_chat_id_string = string & { __brand: "assistant_chat_id" };

// AI : paste chips for UI restore — wire form already lives in content as <pasted>.
export type StoredPastedAttachment = {
  id: string;
  name: string;
  text: string;
};

export type StoredAssistantChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposal?: unknown;
  status?: string;
  invalidCount?: number;
  retryCount?: number;
  validationErrors?: string | null;
  debugTrace?: AssistantDebugEntry[];
  pastes?: StoredPastedAttachment[];
  uiContext?: UiContextRef[];
};

export type AssistantChatSummary = {
  id: assistant_chat_id_string;
  projectId: ProjectId;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  userId: user_id_string;
  ownerEmail: string | null;
  isMine: boolean;
};

export type AssistantChatRecord = AssistantChatSummary & {
  messages: StoredAssistantChatMessage[];
};

type AssistantChatRow = {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  messages: StoredAssistantChatMessage[];
  created_at: number;
  updated_at: number;
};

type JsonStore = {
  chats: AssistantChatRow[];
};

function chatsFile(): string {
  return join(dataDir(), "assistant_chats.json");
}

function loadJsonStore(): JsonStore {
  const path = chatsFile();
  if (!existsSync(path)) return { chats: [] };
  return JSON.parse(readFileSync(path, "utf8")) as JsonStore;
}

function saveJsonStore(store: JsonStore): void {
  const path = chatsFile();
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(path, JSON.stringify(store, null, 2));
}

function isMissingChatsTable(error: { message?: string }): boolean {
  const msg = error.message ?? "";
  return msg.includes("assistant_chats") || msg.includes("schema cache");
}

function rowToSummary(
  row: AssistantChatRow,
  auth: AuthSession,
  emailByUserId: Map<string, string | null>,
): AssistantChatSummary {
  const messages = Array.isArray(row.messages) ? row.messages : [];
  const userId = row.user_id as user_id_string;
  const isMine = userId === auth.userId;
  return {
    id: row.id as assistant_chat_id_string,
    projectId: row.project_id as ProjectId,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: messages.length,
    userId,
    ownerEmail: emailByUserId.get(userId) ?? (isMine ? auth.email ?? null : null),
    isMine,
  };
}

function rowToRecord(
  row: AssistantChatRow,
  auth: AuthSession,
  emailByUserId: Map<string, string | null>,
): AssistantChatRecord {
  return {
    ...rowToSummary(row, auth, emailByUserId),
    messages: Array.isArray(row.messages) ? row.messages : [],
  };
}

async function emailMapForRows(
  auth: AuthSession,
  rows: Pick<AssistantChatRow, "user_id">[],
): Promise<Map<string, string | null>> {
  const ids = [...new Set(rows.map((r) => r.user_id as user_id_string))];
  const map = await emailsForUserIds(ids);
  if (auth.email && !map.get(auth.userId)) map.set(auth.userId, auth.email);
  return map;
}

function titleFromMessages(messages: StoredAssistantChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user" && m.content.trim());
  if (!firstUser) return "New chat";
  const trimmed = firstUser.content.trim();
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
}

const CHAT_SELECT =
  "id, user_id, project_id, title, messages, created_at, updated_at";

async function listSupabaseChats(
  auth: AuthSession,
  projectId: ProjectId,
): Promise<AssistantChatSummary[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("assistant_chats")
    .select(CHAT_SELECT)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as AssistantChatRow[];
  const emails = await emailMapForRows(auth, rows);
  return rows.map((row) => rowToSummary(row, auth, emails));
}

async function getSupabaseChat(
  auth: AuthSession,
  chatId: assistant_chat_id_string,
): Promise<AssistantChatRecord | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("assistant_chats")
    .select(CHAT_SELECT)
    .eq("id", chatId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as AssistantChatRow;
  const emails = await emailMapForRows(auth, [row]);
  return rowToRecord(row, auth, emails);
}

async function createSupabaseChat(
  auth: AuthSession,
  projectId: ProjectId,
  messages: StoredAssistantChatMessage[],
): Promise<AssistantChatRecord> {
  const now = Date.now();
  const row = {
    id: uid("chat_"),
    project_id: projectId,
    title: titleFromMessages(messages),
    messages,
    created_at: now,
    updated_at: now,
  };
  const db = await createClient();
  const { error } = await db.from("assistant_chats").insert(row);
  if (error) throw error;
  const full = { ...row, user_id: auth.userId } as AssistantChatRow;
  const emails = await emailMapForRows(auth, [full]);
  return rowToRecord(full, auth, emails);
}

async function updateSupabaseChat(
  auth: AuthSession,
  chatId: assistant_chat_id_string,
  messages: StoredAssistantChatMessage[],
): Promise<AssistantChatRecord | null> {
  const title = titleFromMessages(messages);
  const updatedAt = Date.now();
  const db = await createClient();
  const { data, error } = await db
    .from("assistant_chats")
    .update({ messages, title, updated_at: updatedAt })
    .eq("id", chatId)
    .select(CHAT_SELECT)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as AssistantChatRow;
  const emails = await emailMapForRows(auth, [row]);
  return rowToRecord(row, auth, emails);
}

function listJsonChats(auth: AuthSession, projectId: ProjectId): AssistantChatSummary[] {
  const rows = loadJsonStore()
    .chats.filter((c) => c.user_id === auth.userId && c.project_id === projectId)
    .sort((a, b) => b.updated_at - a.updated_at);
  const emails = new Map<string, string | null>([[auth.userId, auth.email ?? "dev@local"]]);
  return rows.map((row) => rowToSummary(row, auth, emails));
}

function getJsonChat(auth: AuthSession, chatId: assistant_chat_id_string): AssistantChatRecord | null {
  const row = loadJsonStore().chats.find((c) => c.user_id === auth.userId && c.id === chatId);
  if (!row) return null;
  const emails = new Map<string, string | null>([[auth.userId, auth.email ?? "dev@local"]]);
  return rowToRecord(row, auth, emails);
}

function createJsonChat(
  auth: AuthSession,
  projectId: ProjectId,
  messages: StoredAssistantChatMessage[],
): AssistantChatRecord {
  const now = Date.now();
  const row: AssistantChatRow = {
    id: uid("chat_"),
    user_id: auth.userId,
    project_id: projectId,
    title: titleFromMessages(messages),
    messages,
    created_at: now,
    updated_at: now,
  };
  const store = loadJsonStore();
  store.chats.push(row);
  saveJsonStore(store);
  const emails = new Map<string, string | null>([[auth.userId, auth.email ?? "dev@local"]]);
  return rowToRecord(row, auth, emails);
}

function updateJsonChat(
  auth: AuthSession,
  chatId: assistant_chat_id_string,
  messages: StoredAssistantChatMessage[],
): AssistantChatRecord | null {
  const store = loadJsonStore();
  const i = store.chats.findIndex((c) => c.user_id === auth.userId && c.id === chatId);
  if (i === -1) return null;
  store.chats[i] = {
    ...store.chats[i],
    messages,
    title: titleFromMessages(messages),
    updated_at: Date.now(),
  };
  saveJsonStore(store);
  const emails = new Map<string, string | null>([[auth.userId, auth.email ?? "dev@local"]]);
  return rowToRecord(store.chats[i], auth, emails);
}

// AI : RLS on assistant_chats_delete — only the signed-in user's rows are removable.
async function deleteSupabaseChat(
  auth: AuthSession,
  chatId: assistant_chat_id_string,
): Promise<boolean> {
  const db = await createClient();
  const { data, error } = await db
    .from("assistant_chats")
    .delete()
    .eq("id", chatId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

function deleteJsonChat(auth: AuthSession, chatId: assistant_chat_id_string): boolean {
  const store = loadJsonStore();
  const i = store.chats.findIndex((c) => c.user_id === auth.userId && c.id === chatId);
  if (i === -1) return false;
  store.chats.splice(i, 1);
  saveJsonStore(store);
  return true;
}

async function withJsonFallback<T>(
  auth: AuthSession,
  supabaseFn: () => Promise<T>,
  jsonFn: () => T,
): Promise<T> {
  if (auth.userId === LOCAL_DEV_USER_ID) return jsonFn();
  try {
    return await supabaseFn();
  } catch (err) {
    if (!isMissingChatsTable(err as { message?: string })) throw err;
    return jsonFn();
  }
}

export async function listAssistantChats(
  auth: AuthSession,
  projectId: ProjectId,
): Promise<AssistantChatSummary[]> {
  return withJsonFallback(
    auth,
    () => listSupabaseChats(auth, projectId),
    () => listJsonChats(auth, projectId),
  );
}

export async function getAssistantChat(
  auth: AuthSession,
  chatId: assistant_chat_id_string,
): Promise<AssistantChatRecord | null> {
  return withJsonFallback(
    auth,
    () => getSupabaseChat(auth, chatId),
    () => getJsonChat(auth, chatId),
  );
}

export async function createAssistantChat(
  auth: AuthSession,
  projectId: ProjectId,
  messages: StoredAssistantChatMessage[] = [],
): Promise<AssistantChatRecord> {
  return withJsonFallback(
    auth,
    () => createSupabaseChat(auth, projectId, messages),
    () => createJsonChat(auth, projectId, messages),
  );
}

export async function saveAssistantChatMessages(
  auth: AuthSession,
  chatId: assistant_chat_id_string,
  messages: StoredAssistantChatMessage[],
): Promise<AssistantChatRecord | null> {
  return withJsonFallback(
    auth,
    () => updateSupabaseChat(auth, chatId, messages),
    () => updateJsonChat(auth, chatId, messages),
  );
}

export async function deleteAssistantChat(
  auth: AuthSession,
  chatId: assistant_chat_id_string,
): Promise<boolean> {
  return withJsonFallback(
    auth,
    () => deleteSupabaseChat(auth, chatId),
    () => deleteJsonChat(auth, chatId),
  );
}

export function toStoredAssistantMessages<T extends StoredAssistantChatMessage>(
  messages: T[],
): StoredAssistantChatMessage[] {
  return messages.map(
    ({
      id,
      role,
      content,
      proposal,
      status,
      invalidCount,
      retryCount,
      validationErrors,
      debugTrace,
      pastes,
      uiContext,
    }) => ({
      id,
      role,
      content,
      ...(proposal !== undefined ? { proposal } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(invalidCount !== undefined ? { invalidCount } : {}),
      ...(retryCount !== undefined ? { retryCount } : {}),
      ...(validationErrors !== undefined ? { validationErrors } : {}),
      ...(debugTrace !== undefined && debugTrace.length > 0 ? { debugTrace } : {}),
      ...(pastes !== undefined && pastes.length > 0 ? { pastes } : {}),
      ...(uiContext !== undefined && uiContext.length > 0 ? { uiContext } : {}),
    }),
  );
}
