// AI : landing page email signups — gate demo agent use.

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/server/supabase_admin";
import { logger } from "@/lib/server/server_logger";

const signupLog = logger("landing-signup");

export type landing_signup_email = string;

export function hashLandingDemoIp(ip: string): string {
  const salt = process.env.LANDING_DEMO_IP_SALT;
  if (process.env.VERCEL && !salt) {
    throw new Error("LANDING_DEMO_IP_SALT required on Vercel");
  }
  return createHash("sha256").update(`${salt ?? "landing-demo"}:${ip}`).digest("hex").slice(0, 16);
}

function normalizeEmail(email: landing_signup_email): landing_signup_email {
  return email.trim().toLowerCase();
}

export async function saveLandingPageSignup(email: landing_signup_email, ip: string): Promise<void> {
  const normalized = normalizeEmail(email);
  const admin = await createAdminClient();
  if (!admin) {
    signupLog.warn("landing_page_signups skipped — no admin client");
    return;
  }

  const { error } = await admin.from("landing_page_signups").upsert(
    { email: normalized, ip_hash: hashLandingDemoIp(ip) },
    { onConflict: "email", ignoreDuplicates: true },
  );
  if (error) signupLog.warn("landing_page_signups insert failed", { error: error.message });
}

export async function hasLandingPageSignup(email: landing_signup_email): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const admin = await createAdminClient();
  if (!admin) return true;

  const { data, error } = await admin
    .from("landing_page_signups")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();
  if (error) {
    signupLog.warn("landing_page_signups lookup failed", { error: error.message });
    return true;
  }
  return Boolean(data);
}
