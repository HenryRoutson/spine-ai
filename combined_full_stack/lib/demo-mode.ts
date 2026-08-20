// AI : toggled by /demo — routes doc-text fetches to public demo APIs.
let demoMode = false;
let previewOnly = false;

export function isDemoRoute(): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  return path === "/demo" || path.startsWith("/demo/");
}

function previewQueryEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "1";
}

function embedQueryEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("embed") === "1";
}

// AI : landing iframe (/demo?embed=1&preview=1) must not hydrate a signed-in tab's workspace cache.
export function isIsolatedDemoPreview(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  return embedQueryEnabled() || previewQueryEnabled();
}

function syncFlagsFromLocation(): void {
  if (!isDemoRoute()) return;
  demoMode = true;
  if (previewQueryEnabled()) previewOnly = true;
}

// AI : set before any child render/prefetch — DemoPage effects run too late (children first).
syncFlagsFromLocation();

export function setDemoMode(next: boolean): void {
  demoMode = next;
}

export function isDemoMode(): boolean {
  // AI : pathname fallback — StoreProvider toggles demoMode in an effect, after child prefetches.
  return demoMode || isDemoRoute();
}

export function setPreviewOnly(next: boolean): void {
  previewOnly = next;
}

export function isPreviewOnly(): boolean {
  return previewOnly || previewQueryEnabled();
}
