// AI : shared activity event types — aligned with combined_full_stack user_activity_events.

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

// AI : demo-only — local JSON server records these; Supabase schema omits them.
export type demo_activity_category = activity_category | "sign_in" | "sign_out";

export type user_id_string = string;
export type user_email_string = string;

export type activity_event_detail = {
  tag?: string;
  field?: string;
  value?: string;
  length?: number;
  window?: string;
  message?: string;
  source?: string;
  selector?: string;
  testId?: string;
};

export type activity_event_input = {
  category: activity_category;
  action: string;
  detail?: activity_event_detail;
  projectId?: string;
};

export type activity_event_row = activity_event_input & {
  id: string;
  userId: user_id_string;
  userEmail: user_email_string | null;
  createdAt: string;
};

export type signed_in_user = {
  userId: user_id_string;
  email: user_email_string;
  displayName: string;
};

export const MAX_INPUT_PREVIEW_CHARS = 2_000;

export function sanitizeActivityInputText(text: string): string {
  return text.slice(0, MAX_INPUT_PREVIEW_CHARS);
}
