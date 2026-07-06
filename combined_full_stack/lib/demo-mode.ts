// AI : toggled by /demo — routes doc-text fetches to public demo APIs.
let demoMode = false;
let previewOnly = false;

export function setDemoMode(next: boolean): void {
  demoMode = next;
}

export function isDemoMode(): boolean {
  return demoMode;
}

export function setPreviewOnly(next: boolean): void {
  previewOnly = next;
}

export function isPreviewOnly(): boolean {
  return previewOnly;
}
