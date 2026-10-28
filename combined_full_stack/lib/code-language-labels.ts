import { CustomCodeLanguage } from "@/lib/types"

export const CUSTOM_CODE_LANG_SHORT: Record<CustomCodeLanguage, string> = {
  [CustomCodeLanguage.TypeScript]: "TS",
  [CustomCodeLanguage.Python]: "PY",
}

export const CUSTOM_CODE_LANG_LABEL: Record<CustomCodeLanguage, string> = {
  [CustomCodeLanguage.TypeScript]: "TypeScript",
  [CustomCodeLanguage.Python]: "Python",
}

// AI : back-compat aliases — prefer CUSTOM_CODE_LANG_* in new code.
export const CODE_LANG_SHORT = CUSTOM_CODE_LANG_SHORT
export const CODE_LANG_NAME = CUSTOM_CODE_LANG_LABEL
