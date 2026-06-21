// AI : user-authored transform/custom steps — runs in the browser during inference (no server vm).
// AI : unsandboxed in the user's tab is fine: they already control their browser; this keeps
// AI : arbitrary code off the server and away from OPENROUTER_API_KEY / process.env.

export type CustomFn = (input: unknown) => unknown | Promise<unknown>;

const CUSTOM_CODE_TIMEOUT_MS = 15_000;

export function compileCustomFn(code: string): CustomFn {
  const isExpression = /^\s*(\(|function\b|async\b)/.test(code);
  const src = isExpression ? `(${code})` : `((input) => { ${code} })`;
  const fn = new Function(`return ${src}`)();
  if (typeof fn !== "function") throw new Error("custom code must evaluate to a function (input) => output");
  return fn as CustomFn;
}

export async function runCustomFn(code: string, input: unknown): Promise<unknown> {
  const fn = compileCustomFn(code);
  const result = fn(input);
  if (!(result instanceof Promise)) return result;
  return Promise.race([
    result,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`custom code timed out after ${CUSTOM_CODE_TIMEOUT_MS}ms`)), CUSTOM_CODE_TIMEOUT_MS),
    ),
  ]);
}

export function isUserCodeStep(kind: string, code?: string): boolean {
  return kind === "custom-code" || (kind === "transform" && !!code?.trim());
}
