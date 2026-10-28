// AI : single Monaco dark theme id — colorize + editor previews must match for mtk class colors.
export const MONACO_VS_DARK_THEME = "vs-dark" as const

export type MonacoVsDarkTheme = typeof MONACO_VS_DARK_THEME

export const MONACO_VS_DARK_FG = "#d4d4d4"
export const MONACO_VS_DARK_BG = "#1e1e1e"

export const MONACO_CODE_PREVIEW_BASE_CLASS =
  "bg-[#1e1e1e] font-mono leading-snug text-[#d4d4d4]"
