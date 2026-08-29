// AI : Windmill EE connection — URL + token + workspace. Never log the token.

export type WindmillConfig = {
  url: string
  token: string
  workspace: string
}

export function readWindmillConfig(env: Record<string, string | undefined> = process.env): WindmillConfig | null {
  const url = env.WINDMILL_URL?.trim().replace(/\/$/, "")
  const token = env.WINDMILL_TOKEN?.trim()
  const workspace = env.WINDMILL_WORKSPACE?.trim() || "admins"
  if (!url || !token) return null
  return { url, token, workspace }
}

export function windmillConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return readWindmillConfig(env) != null
}

export function shouldRunOnWindmill(
  project: { windmillExecute?: boolean } | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return !!project?.windmillExecute && windmillConfigured(env)
}
