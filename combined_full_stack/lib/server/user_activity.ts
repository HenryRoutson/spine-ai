import { createAdminClient } from "./supabase_admin";
import type { user_id_string } from "./require_auth";

export type activity_category =
  | "ui_click"
  | "ui_input"
  | "ui_navigate"
  | "error"
  | "llm_call"
  | "step_create"
  | "step_delete"
  | "step_modify"
  | "log_view"
  | "run_start"
  | "run_complete";

export type activity_event_input = {
  userId: user_id_string;
  userEmail?: string | null;
  category: activity_category;
  action: string;
  detail?: Record<string, unknown>;
  projectId?: string;
  costCents?: number;
};

export type activity_event_row = activity_event_input & {
  id: string;
  createdAt: string;
};

const MAX_ACTION_CHARS = 500;
const MAX_DETAIL_CHARS = 8_000;
const MAX_INPUT_PREVIEW_CHARS = 2_000;

function isMissingActivityTable(error: { message?: string }): boolean {
  const msg = error.message ?? "";
  return msg.includes("user_activity_events") || msg.includes("schema cache");
}

function trimAction(action: string): string {
  return action.trim().slice(0, MAX_ACTION_CHARS);
}

function trimDetail(detail: Record<string, unknown>): Record<string, unknown> {
  const raw = JSON.stringify(detail);
  if (raw.length <= MAX_DETAIL_CHARS) return detail;
  return { truncated: true, preview: raw.slice(0, MAX_DETAIL_CHARS) };
}

export function sanitizeActivityInputText(text: string): string {
  return text.slice(0, MAX_INPUT_PREVIEW_CHARS);
}

export async function recordActivityEvents(events: activity_event_input[]): Promise<void> {
  if (events.length === 0) return;
  const admin = await createAdminClient();
  if (!admin) return;

  const rows = events.map((e) => ({
    user_id: e.userId,
    user_email: e.userEmail ?? null,
    category: e.category,
    action: trimAction(e.action),
    detail: trimDetail(e.detail ?? {}),
    project_id: e.projectId ?? null,
    cost_cents: e.costCents != null && e.costCents > 0 ? +e.costCents.toFixed(4) : null,
  }));

  const { error } = await admin.from("user_activity_events").insert(rows);
  if (error && !isMissingActivityTable(error)) {
    console.warn("user_activity_events insert failed:", error.message);
  }
}

export async function recordActivityEvent(event: activity_event_input): Promise<void> {
  await recordActivityEvents([event]);
}
