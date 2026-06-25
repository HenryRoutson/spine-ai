// AI : localStorage key prefix — keep in sync with public/json-viewer.html JV_*_KEY constants.

export const APP_STORAGE_PREFIX = "auto-pipeline:" as const

export function appStorageKey(suffix: string): string {
  return `${APP_STORAGE_PREFIX}${suffix}`
}
