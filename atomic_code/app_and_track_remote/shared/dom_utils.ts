// AI : generic DOM helpers — same logic for record and replay in any React app.

export function elementLabel(el: HTMLElement): string {
  const testId = el.getAttribute("data-testid");
  if (testId) return testId.slice(0, 200);
  const aria = el.getAttribute("aria-label");
  if (aria) return aria.slice(0, 200);
  const title = el.getAttribute("title");
  if (title) return title.slice(0, 200);
  const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  if (text) return text.slice(0, 200);
  const name = el.getAttribute("name");
  if (name) return name.slice(0, 200);
  return el.tagName.toLowerCase();
}

export function inputFieldLabel(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): string {
  const testId = el.getAttribute("data-testid");
  if (testId) return testId.slice(0, 120);
  const id = el.id;
  if (id) {
    const label = el.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label?.textContent) return label.textContent.replace(/\s+/g, " ").trim().slice(0, 120);
  }
  return el.getAttribute("placeholder") ?? el.getAttribute("name") ?? el.tagName.toLowerCase();
}

export function buildSelector(el: HTMLElement): string {
  const testId = el.getAttribute("data-testid");
  if (testId) return `[data-testid="${testId}"]`;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const name = el.getAttribute("name");
  if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;
  return el.tagName.toLowerCase();
}

export function findByRecordedSelector(
  doc: Document | ParentNode,
  selector?: string,
  testId?: string,
): HTMLElement | null {
  if (selector) {
    const bySelector = doc.querySelector(selector);
    if (bySelector instanceof HTMLElement) return bySelector;
  }
  if (testId) {
    const byTestId = doc.querySelector(`[data-testid="${CSS.escape(testId)}"]`);
    if (byTestId instanceof HTMLElement) return byTestId;
  }
  return null;
}

export function findClickTarget(
  label: string,
  tag?: string,
  doc: Document | ParentNode = document,
  hint?: { selector?: string; testId?: string },
): HTMLElement | null {
  const byRecorded = hint ? findByRecordedSelector(doc, hint.selector, hint.testId) : null;
  if (byRecorded) return byRecorded;

  const byTestId = doc.querySelector(`[data-testid="${CSS.escape(label)}"]`);
  if (byTestId instanceof HTMLElement) return byTestId;

  const candidates = doc.querySelectorAll("button, a[href], [role='button'], input[type='submit']");
  for (const node of candidates) {
    if (!(node instanceof HTMLElement)) continue;
    if (tag && node.tagName.toLowerCase() !== tag) continue;
    if (elementLabel(node) === label) return node;
  }

  for (const node of candidates) {
    if (!(node instanceof HTMLElement)) continue;
    const nodeLabel = elementLabel(node);
    if (nodeLabel.includes(label) || label.includes(nodeLabel)) return node;
  }
  return null;
}

export function findInputTarget(
  field: string,
  doc: Document | ParentNode = document,
  hint?: { selector?: string; testId?: string },
): HTMLInputElement | HTMLTextAreaElement | null {
  const byRecorded = hint ? findByRecordedSelector(doc, hint.selector, hint.testId) : null;
  if (byRecorded instanceof HTMLInputElement || byRecorded instanceof HTMLTextAreaElement) return byRecorded;

  const byTestId = doc.querySelector(`[data-testid="${CSS.escape(field)}"]`);
  if (byTestId instanceof HTMLInputElement || byTestId instanceof HTMLTextAreaElement) return byTestId;

  const inputs = doc.querySelectorAll("input, textarea");
  for (const node of inputs) {
    if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) continue;
    if (inputFieldLabel(node) === field) return node;
  }

  for (const node of inputs) {
    if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) continue;
    const lbl = inputFieldLabel(node);
    if (lbl.includes(field) || field.includes(lbl)) return node;
  }
  return null;
}

// AI : native .click() reaches React handlers; synthetic MouseEvent dispatch often does not.
export function replayClick(el: HTMLElement): void {
  el.click();
}

export function replayInputValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const previousValue = el.value;
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;

  const tracker = (el as HTMLInputElement & { _valueTracker?: { setValue: (v: string) => void } })
    ._valueTracker;
  if (tracker) tracker.setValue(previousValue);

  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export function detectActiveNavWindow(
  doc: Document,
  windows: readonly string[] = ["home", "tasks", "settings"],
): string | null {
  for (const windowName of windows) {
    const nav = doc.querySelector(`[data-testid="nav-${CSS.escape(windowName)}"]`);
    if (nav instanceof HTMLElement && !nav.classList.contains("secondary")) return windowName;
  }
  return null;
}

export async function waitForReplayReady(
  doc: Document,
  timeoutMs = 8_000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (detectActiveNavWindow(doc) || doc.querySelector('[data-testid="nav-home"]')) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

export function highlightElement(el: HTMLElement): () => void {
  const prev = el.style.outline;
  const prevBg = el.style.backgroundColor;
  el.style.outline = "2px solid #635bff";
  el.style.backgroundColor = "rgba(99, 91, 255, 0.12)";
  el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  return () => {
    el.style.outline = prev;
    el.style.backgroundColor = prevBg;
  };
}
