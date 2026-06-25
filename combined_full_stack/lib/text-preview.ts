// AI : flatten whitespace + truncate — shared by logging UI, server logs, and run_engine previews.

export const PREVIEW_STEP_IO_CHARS = 100
export const PREVIEW_RUN_NOTES_CHARS = 72
export const PREVIEW_RUN_STEP_CHARS = 160
export const PREVIEW_SERVER_LOGS_CHARS = PREVIEW_STEP_IO_CHARS

export function compactPreview(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim()
  return flat.length <= max ? flat : `${flat.slice(0, max)}…`
}
