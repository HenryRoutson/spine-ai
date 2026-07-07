import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  hasAccessKeyConfigured,
  safeNextPath,
  sessionCookieOptions,
  sessionToken,
  SESSION_COOKIE,
  verifyAccessKey,
} from "@/lib/auth";

async function loginAction(formData: FormData) {
  "use server";

  const key = String(formData.get("key") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "/"));
  if (!verifyAccessKey(key)) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  }

  const token = sessionToken();
  if (!token) redirect("/login?error=unconfigured");

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
  redirect(next);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const nextPath = safeNextPath(next);

  if (!hasAccessKeyConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="panel w-full max-w-md p-6">
          <h1 className="text-xl font-semibold tracking-tight">Ops dashboard</h1>
          <p className="mt-2 text-sm text-muted">
            Localhost-only console. Reads credentials from the repo root{" "}
            <code className="font-mono text-xs">.env</code>.
          </p>
          <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Set <code className="font-mono">DASHBOARD_ACCESS_KEY</code> in the repo root{" "}
            <code className="font-mono">.env</code>, then restart the dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="panel w-full max-w-md p-6">
        <h1 className="text-xl font-semibold tracking-tight">Ops dashboard</h1>
        <p className="mt-2 text-sm text-muted">
          Localhost-only console. Enter the access key from the repo root{" "}
          <code className="font-mono text-xs">.env</code>.
        </p>
        {error === "invalid" ? (
          <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Invalid access key.
          </p>
        ) : null}
        {error === "unconfigured" ? (
          <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Dashboard session could not be created — check{" "}
            <code className="font-mono">DASHBOARD_ACCESS_KEY</code> in the repo root{" "}
            <code className="font-mono">.env</code> and restart.
          </p>
        ) : null}
        <form action={loginAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={nextPath} />
          <div>
            <label htmlFor="key" className="text-sm text-muted">
              Access key
            </label>
            <input
              id="key"
              name="key"
              type="password"
              required
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-line bg-background px-3 py-2 font-mono text-sm"
            />
          </div>
          <button type="submit" className="btn w-full">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
