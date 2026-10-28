// AI : runtime invariants — throw immediately so bugs surface during dev/tests instead of corrupting state.

export function invariant(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ? `Invariant failed: ${message}` : "Invariant failed");
  }
}

export function assertDefined<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Invariant failed: ${message}`);
  }
  return value;
}

export function assertNever(value: never, message?: string): never {
  throw new Error(message ?? `Unexpected value: ${String(value)}`);
}
