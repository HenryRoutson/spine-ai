// AI : shared seed-doc helpers — safe on client + server (no fs imports).

const UNAVAILABLE_PREFIX = "[seed doc unavailable on this deploy:";

export function unavailableSeedDocMessage(name: string): string {
  return `${UNAVAILABLE_PREFIX} ${name}]`;
}

export function isUnavailableSeedDoc(content: string, name: string): boolean {
  return content === unavailableSeedDocMessage(name);
}

export function looksLikeUnavailableSeedDoc(content: string): boolean {
  return content.startsWith(UNAVAILABLE_PREFIX);
}
