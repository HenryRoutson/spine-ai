// AI : searchable GUI action ids — same string on data-spine-id, TUI/MCP/docs, and tests.

export const SPINE_ACTION_ATTR = "data-spine-id" as const

export function spineActionProps(id: string): { "data-spine-id": string } {
  return { [SPINE_ACTION_ATTR]: id }
}

export const PARITY_STATUS = ["Y", "P", "N", "host", "n/a"] as const
export type ParityStatus = (typeof PARITY_STATUS)[number]

export type ParitySurface = {
  how: string
  status: ParityStatus
  ref?: string
}

export type ParityRow = {
  id: string
  window: string
  gui: ParitySurface & { label: string; file: string }
  tui: ParitySurface
  api: ParitySurface
  mcp: ParitySurface
  library: ParitySurface
}

export function renderParityMarkdownTable(rows: ParityRow[]): string {
  const header =
    "| id | GUI | TUI | API | MCP | Library |\n|---|---|---|---|---|---|"
  const body = rows.map((row) => {
    const cells = [
      `\`${row.id}\``,
      cell(row.gui.label, row.gui),
      cell(row.tui.how, row.tui),
      cell(row.api.how, row.api),
      cell(row.mcp.how, row.mcp),
      cell(row.library.how, row.library),
    ]
    return `| ${cells.join(" | ")} |`
  })
  return [header, ...body].join("\n")
}

function cell(text: string, surface: ParitySurface): string {
  const mark = surface.status === "Y" ? "" : ` [${surface.status}]`
  return `${escapeMd(text)}${mark}`
}

function escapeMd(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ")
}
