export type AuthMode = "sign-in" | "sign-up";

export function authErrorMessage(
  error: { message: string; code?: string },
  mode: AuthMode,
): string {
  if (error.code === "invalid_credentials" || error.message === "Invalid login credentials")
    return mode === "sign-in"
      ? "No account with those credentials — sign up first, or check your password."
      : error.message;
  if (error.code === "email_address_invalid")
    return "That email address isn't allowed — try a real address (e.g. Gmail).";
  if (error.code === "over_email_send_rate_limit")
    return "Too many sign-up emails sent — wait a few minutes and try again.";
  return error.message;
}
