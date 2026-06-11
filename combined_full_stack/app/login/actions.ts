"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { authErrorMessage, type AuthMode } from "@/utils/supabase/auth_messages";

export type AuthActionState = { error?: string; notice?: string } | null;

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

  const { data, error } = await supabase.auth.signUp({ email, password });
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
