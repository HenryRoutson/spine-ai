// AI : AST-based line profiler injection — acorn parse + astring codegen (no regex line surgery).
import { parse, parseExpressionAt, type Node, type Options, type Program } from "acorn"
import { generate } from "astring"
import type {
  ArrowFunctionExpression,
  BlockStatement,
  CallExpression,
  Expression,
  ExpressionStatement,
  Statement as EstreeStatement,
} from "estree"

const PARSE_OPTS = {
  ecmaVersion: 2022,
  sourceType: "script",
  locations: true,
} satisfies Options

type AnyNode = Node

export type InstrumentCodeOpts = {
  // AI : await __forgeTrace + rAF between lines so Inference can paint the active line.
  visual?: boolean
}

function traceCall(line: number, slot = 0, visual = false): ExpressionStatement {
  const args: Expression[] = [
    { type: "Literal", value: line },
    ...(slot > 0 ? [{ type: "Literal", value: slot } satisfies Expression] : []),
  ]
  const call: CallExpression = {
    type: "CallExpression",
    callee: { type: "Identifier", name: "__forgeTrace" },
    arguments: args,
    optional: false,
  }
  const expression: Expression = visual ? { type: "AwaitExpression", argument: call } : call
  return { type: "ExpressionStatement", expression }
}

function nextSlot(slots: Map<number, number>, line: number): number {
  const slot = (slots.get(line) ?? 0) + 1
  slots.set(line, slot)
  return slot
}

// AI : awaitAsync only for the outermost expression-form arrow — nested .map/.flatMap must stay sync
// AI : or visual mode turns `rows.map((e) => e?.id)` into Promise[] and assert id sets go empty.
function instrumentArrowBody(
  fn: ArrowFunctionExpression,
  line: number,
  slot: number,
  awaitAsync: boolean,
): void {
  if (awaitAsync) fn.async = true
  const entry = traceCall(line, slot, awaitAsync)
  if (fn.body.type === "BlockStatement") {
    fn.body.body.unshift(entry)
    return
  }
  fn.body = {
    type: "BlockStatement",
    body: [entry, { type: "ReturnStatement", argument: fn.body }],
  }
}

function visitArrows(node: AnyNode, slots: Map<number, number>, awaitAsync: boolean): void {
  if (!node || typeof node !== "object") return
  if (node.type === "ArrowFunctionExpression") {
    const fn = node as unknown as ArrowFunctionExpression
    const line = fn.loc?.start.line ?? 1
    instrumentArrowBody(fn, line, nextSlot(slots, line), awaitAsync)
    // AI : children of this arrow never await — callbacks must return values, not Promises.
    for (const key of Object.keys(node)) {
      const child = (node as unknown as Record<string, unknown>)[key]
      if (Array.isArray(child)) {
        for (const item of child) visitArrows(item as AnyNode, slots, false)
      } else if (child && typeof child === "object" && "type" in child) {
        visitArrows(child as AnyNode, slots, false)
      }
    }
    return
  }
  for (const key of Object.keys(node)) {
    const child = (node as unknown as Record<string, unknown>)[key]
    if (Array.isArray(child)) {
      for (const item of child) visitArrows(item as AnyNode, slots, awaitAsync)
    } else if (child && typeof child === "object" && "type" in child) {
      visitArrows(child as AnyNode, slots, awaitAsync)
    }
  }
}

function instrumentBlock(stmts: EstreeStatement[], visual: boolean): EstreeStatement[] {
  const out: EstreeStatement[] = []
  for (const stmt of stmts) {
    const line = stmt.loc?.start.line
    if (line != null) out.push(traceCall(line, 0, visual))
    instrumentNested(stmt, visual)
    out.push(stmt)
  }
  return out
}

function instrumentLoopBody(body: EstreeStatement | BlockStatement, visual: boolean): void {
  if (body.type === "BlockStatement") {
    body.body = instrumentBlock(body.body, visual)
    return
  }
  const wrapped: BlockStatement = { type: "BlockStatement", body: [body] }
  instrumentNested(wrapped, visual)
}

function instrumentSwitchCases(cases: { consequent: EstreeStatement[] }[], visual: boolean): void {
  for (const c of cases) {
    c.consequent = instrumentBlock(c.consequent, visual)
  }
}

function instrumentNested(stmt: EstreeStatement, visual: boolean): void {
  switch (stmt.type) {
    case "BlockStatement":
      stmt.body = instrumentBlock(stmt.body, visual)
      break
    case "IfStatement":
      if (stmt.consequent.type === "BlockStatement") {
        stmt.consequent.body = instrumentBlock(stmt.consequent.body, visual)
      } else {
        instrumentNested(stmt.consequent, visual)
      }
      if (stmt.alternate) {
        if (stmt.alternate.type === "BlockStatement") {
          stmt.alternate.body = instrumentBlock(stmt.alternate.body, visual)
        } else {
          instrumentNested(stmt.alternate, visual)
        }
      }
      break
    case "ForStatement":
    case "ForInStatement":
    case "ForOfStatement":
    case "WhileStatement":
    case "DoWhileStatement":
      instrumentLoopBody(stmt.body, visual)
      break
    case "SwitchStatement":
      instrumentSwitchCases(stmt.cases, visual)
      break
    case "TryStatement":
      stmt.block.body = instrumentBlock(stmt.block.body, visual)
      if (stmt.handler?.body.type === "BlockStatement") {
        stmt.handler.body.body = instrumentBlock(stmt.handler.body.body, visual)
      }
      if (stmt.finalizer) instrumentNested(stmt.finalizer, visual)
      break
    case "LabeledStatement":
      instrumentNested(stmt.body, visual)
      break
    case "WithStatement":
      instrumentLoopBody(stmt.body, visual)
      break
    default:
      break
  }
}

function isArrowExpressionProgram(ast: Program): boolean {
  if (ast.body.length !== 1) return false
  const stmt = ast.body[0]
  return stmt?.type === "ExpressionStatement" && stmt.expression.type === "ArrowFunctionExpression"
}

function instrumentProgram(ast: Program, visual: boolean): Program {
  const slots = new Map<number, number>()
  // AI : only the top-level expression-form arrow may become async for visual rAF pauses.
  const topArrowAwait = visual && isArrowExpressionProgram(ast)
  visitArrows(ast, slots, topArrowAwait)
  // AI : bare `(doc) => …` must stay expression-form for buildCustomFnSource — no leading trace stmt.
  if (!isArrowExpressionProgram(ast)) {
    ast.body = instrumentBlock(ast.body as EstreeStatement[], visual) as Program["body"]
  }
  return ast
}

function parseUserProgram(code: string): Program {
  try {
    return parse(code, PARSE_OPTS) as Program
  } catch {
    const expr = parseExpressionAt(code, 0, PARSE_OPTS) as Expression
    return {
      type: "Program",
      body: [{ type: "ExpressionStatement", expression: expr }],
      sourceType: "script",
    } as Program
  }
}

export function instrumentArrowSourceAst(code: string, opts: InstrumentCodeOpts = {}): string {
  const trimmed = code.trim()
  if (!trimmed) return code
  const visual = opts.visual === true
  const ast = instrumentProgram(parseUserProgram(trimmed), visual)
  if (isArrowExpressionProgram(ast)) {
    return generate((ast.body[0] as ExpressionStatement).expression)
  }
  return instrumentCodeLinesAst(code, opts)
}

export function instrumentCodeLinesAst(code: string, opts: InstrumentCodeOpts = {}): string {
  const trimmed = code.trim()
  if (!trimmed) return code
  const visual = opts.visual === true
  const ast = instrumentProgram(parseUserProgram(trimmed), visual)
  if (isArrowExpressionProgram(ast)) {
    const expr = (ast.body[0] as ExpressionStatement).expression
    return `(${generate(expr)})`
  }
  return generate(ast)
}
