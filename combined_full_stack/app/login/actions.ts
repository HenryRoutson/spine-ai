"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { authErrorMessage, type AuthMode } from "@/utils/supabase/auth_messages";
import { LEGAL } from "@/lib/legal/site";

export type AuthActionState = { error?: string; notice?: string } | null;

function signupConsentError(formData: FormData): string | null {
  if (formData.get("age_confirmed") !== "yes") {
    return `You must confirm you are at least ${LEGAL.minAgeYears} years old.`;
  }
  if (formData.get("accept_terms") !== "yes") {
    return "You must accept the Terms of Service.";
  }
  if (formData.get("accept_privacy") !== "yes") {
    return "You must confirm you have read the Privacy Policy.";
  }
  return null;
}

// AI : server-side sign-in sets session cookies the proxy/API can read on Vercel HTTPS.
export async function authAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const mode = formData.get("mode") as AuthMode;
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  if (mode === "sign-in") {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: authErrorMessage(error, mode) };
    revalidatePath("/", "layout");
    redirect("/");
  }

  const consentError = signupConsentError(formData);
  if (consentError) return { error: consentError };

  const marketingOptIn = formData.get("marketing_opt_in") === "yes";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        marketing_opt_in: marketingOptIn,
        tos_version: LEGAL.policyVersion,
        privacy_version: LEGAL.policyVersion,
        age_confirmed_at: new Date().toISOString(),
      },
    },
  });
  if (error) return { error: authErrorMessage(error, mode) };
  if (data.user && data.user.identities?.length === 0) {
    return { error: "An account with this email already exists — sign in instead." };
  }
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/");
  }
  return {
    notice: "Account created — check your email for a confirmation link, then sign in.",
  };
}
