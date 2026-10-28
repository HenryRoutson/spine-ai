// AI : remember landing demo email locally so returning visitors skip the gate.

const STORAGE_KEY = "landing_demo_email";

export type demo_email_string = string;

export function readDemoEmail(): demo_email_string | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY)?.trim().toLowerCase();
  return stored || null;
}

export function writeDemoEmail(email: demo_email_string): void {
  localStorage.setItem(STORAGE_KEY, email.trim().toLowerCase());
}
