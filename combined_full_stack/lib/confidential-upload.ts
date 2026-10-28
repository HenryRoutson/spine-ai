// AI : block uploads when the filename suggests confidential material.
// AI : TODO (jank-confidential-name) — filename substring only (UX hint); trivial bypass — do not treat as access control.
export function confidentialUploadWarning(fileName: string): string | null {
  if (!fileName.toLowerCase().includes("confidential")) return null
  return `Upload blocked: "${fileName}" contains "confidential" in its name.`
}
