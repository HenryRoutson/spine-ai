export const SECRETS_CHANGED_EVENT = "forge:secrets-changed"

export function notifySecretsChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(SECRETS_CHANGED_EVENT))
}
