// AI : types live here so lib/ and mcp_tool tsc can import them without parsing code-viewer.tsx (jsx).
export type CodeViewerLanguage = "python" | "typescript" | "rust" | "go" | "baml" | "sql" | "json"

export type MultiLangCodeSource = {
  language: CodeViewerLanguage
  label: string
  filename: string
  content: string
  hint?: "runtime" | "export"
}
