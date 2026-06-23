// AI : block uploads when the filename suggests confidential material.
export function confidentialUploadWarning(fileName: string): string | null {
  if (!fileName.toLowerCase().includes("confidential")) return null
  return `Upload blocked: "${fileName}" contains "confidential" in its name.`
}
