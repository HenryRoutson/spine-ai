import vm from "node:vm";

// AI : custom TS step — the module's `code` string is compiled into ONE function mapping
// AI : input → output. Useful for splitting tasks into small deterministic pieces (sort,
// AI : filter, reshape) without paying for an LLM call. Output still passes implicit
// AI : schema validation in the run engine like every other step.
// AI : NOTE — vm is an isolation convenience, not a security boundary; fine for the local prototype.

export type CustomFn = (input: unknown) => unknown | Promise<unknown>;

export function compileCustomFn(code: string): CustomFn {
  // accept a function expression `(input) => ...` / `function (input) {...}`,
  // or a bare body that uses `input` and `return`s the output
  const isExpression = /^\s*(\(|function\b|async\b)/.test(code);
  const src = isExpression ? `(${code})` : `((input) => { ${code} })`;
  const fn = vm.runInNewContext(src, { console }, { timeout: 1_000 });
  if (typeof fn !== "function") throw new Error("custom code must evaluate to a function (input) => output");
  return fn as CustomFn;
}

export async function runCustomFn(code: string, input: unknown): Promise<unknown> {
  return compileCustomFn(code)(input);
}
