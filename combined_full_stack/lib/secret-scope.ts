// AI : three secret sources — personal (link like docs), project-prefixed, team (no value visibility).

export type SecretScope = "personal" | "project" | "team"

export type secret_logical_name = string & { __brand: "secret_logical_name" }
export type project_secret_prefix = string & { __brand: "project_secret_prefix" }

export function projectSecretPrefix(projectName: string): project_secret_prefix {
  const slug = projectName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48)
  return (slug.length >= 1 ? slug : "PROJECT") as project_secret_prefix
}

export function projectScopedSecretName(prefix: project_secret_prefix, logicalName: string): string {
  return `${prefix}_${logicalName}`
}

export function logicalNameFromProjectScoped(
  prefix: project_secret_prefix,
  storedName: string,
): string | null {
  const head = `${prefix}_`
  if (!storedName.startsWith(head)) return null
  const logical = storedName.slice(head.length)
  return logical.length > 0 ? logical : null
}

// AI : overlay PREFIX_KEY → KEY so webhook env:KEY resolves project-scoped rows.
export function overlayProjectPrefixedSecrets(
  env: Record<string, string>,
  prefix: project_secret_prefix,
): Record<string, string> {
  const out = { ...env }
  for (const [name, value] of Object.entries(env)) {
    const logical = logicalNameFromProjectScoped(prefix, name)
    if (logical && value) out[logical] = value
  }
  return out
}
