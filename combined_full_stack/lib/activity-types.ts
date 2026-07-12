// AI : shared activity types — safe for client import without server deps.

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

const MAX_INPUT_PREVIEW_CHARS = 2_000;

export function sanitizeActivityInputText(text: string): string {
  return text.slice(0, MAX_INPUT_PREVIEW_CHARS);
}
