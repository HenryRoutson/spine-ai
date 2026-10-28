import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@/utils/supabase/server";
import { uid } from "../id";
import { dataDir } from "./config";
import { LOCAL_DEV_USER_ID, type AuthSession } from "./require_auth";

export type feedback_id_string = string & { __brand: "feedback_id" };

export type UserFeedbackEntry = {
  id: feedback_id_string;
  userId: string;
  userEmail: string | undefined;
  message: string;
  createdAt: number;
};

type FeedbackRow = {
  id: string;
  user_id: string;
  user_email: string | null;
  message: string;
  created_at: number;
};

function feedbackFile(): string {
  return join(dataDir(), "user_feedback.json");
}

function loadJsonFeedback(): UserFeedbackEntry[] {
  const path = feedbackFile();
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8")) as UserFeedbackEntry[];
}

function appendJsonFeedback(entry: UserFeedbackEntry): void {
  const path = feedbackFile();
  mkdirSync(dataDir(), { recursive: true });
  const all = loadJsonFeedback();
  all.push(entry);
  writeFileSync(path, JSON.stringify(all, null, 2));
}

function isMissingFeedbackTable(error: { message?: string }): boolean {
  const msg = error.message ?? "";
  return msg.includes("user_feedback") || msg.includes("schema cache");
}

async function saveSupabaseFeedback(entry: UserFeedbackEntry): Promise<void> {
  const db = await createClient();
  const { error } = await db.from("user_feedback").insert({
    id: entry.id,
    user_id: entry.userId,
    user_email: entry.userEmail ?? null,
    message: entry.message,
    created_at: entry.createdAt,
  } satisfies FeedbackRow);
  if (error) throw error;
}

export async function saveUserFeedback(
  auth: AuthSession,
  message: string,
): Promise<UserFeedbackEntry> {
  const trimmed = message.trim();
  if (!trimmed) throw new Error("Feedback message is required.");

  const entry: UserFeedbackEntry = {
    id: uid<feedback_id_string>("fb_"),
    userId: auth.userId,
    userEmail: auth.email,
    message: trimmed,
    createdAt: Date.now(),
  };

  if (auth.userId === LOCAL_DEV_USER_ID) {
    appendJsonFeedback(entry);
    return entry;
  }

  try {
    await saveSupabaseFeedback(entry);
  } catch (err) {
    if (!isMissingFeedbackTable(err as { message?: string })) throw err;
    appendJsonFeedback(entry);
  }

  return entry;
}
