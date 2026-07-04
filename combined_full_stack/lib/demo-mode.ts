// AI : toggled by /demo — routes doc-text fetches to public demo APIs.
let demoMode = false;

export function setDemoMode(next: boolean): void {
  demoMode = next;
}

export function isDemoMode(): boolean {
  return demoMode;
}
