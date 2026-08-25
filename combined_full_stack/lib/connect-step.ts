// AI : Connect step export — env-backed Nango HTTP, never bake tokens or connection ids.
import { getConnectAction } from "@/lib/connect-catalog"
import { fillNangoEndpoint } from "@/lib/connect-request"
import type { PipelineModule } from "@/lib/types"

function exportConnectCallTs(m: PipelineModule): string {
  const id = m.connectActionId?.trim() ?? ""
  const entry = getConnectAction(id)
  const params = m.connectParameters ?? {}
  if (!entry) {
    return `throw new Error(${JSON.stringify(`unknown connect action: ${id}`)});`
  }
  if (entry.auth === "none") {
    return [
      `const raw = await runConnectAction({`,
      `  kind: "http",`,
      `  actionId: ${JSON.stringify(id)},`,
      `  method: ${JSON.stringify(typeof params.method === "string" ? params.method : entry.method)},`,
      `  url: ${JSON.stringify(typeof params.url === "string" ? params.url : "")},`,
      `  body: { input },`,
      `});`,
    ].join("\n")
  }
  const needsCf = entry.id === "slack.postMessage" || entry.id === "gmail.send"
  const cf = needsCf
    ? `const _cf = (v: unknown, k: string) => v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>)[k] : undefined;`
    : ""
  let endpoint = fillNangoEndpoint(entry.nangoEndpoint, params)
  if (entry.id === "sheets.append" && !endpoint.includes("valueInputOption")) {
    endpoint = `${endpoint}${endpoint.includes("?") ? "&" : "?"}valueInputOption=USER_ENTERED`
  }
  let bodyExpr = `{ ...${JSON.stringify(params)}, input }`
  if (entry.id === "slack.postMessage") {
    const textField = JSON.stringify(String(params.textField ?? "text"))
    bodyExpr = `{ channel: ${JSON.stringify(params.channel ?? "#general")}, text: typeof _cf(input, ${textField}) === "string" ? _cf(input, ${textField}) : JSON.stringify(input) }`
  } else if (entry.id === "gmail.send") {
    bodyExpr = `{ to: _cf(input, ${JSON.stringify(String(params.toField ?? "to"))}), subject: _cf(input, ${JSON.stringify(String(params.subjectField ?? "subject"))}), body: _cf(input, ${JSON.stringify(String(params.bodyField ?? "body"))}) }`
  } else if (entry.id === "sheets.append") {
    bodyExpr = `{ majorDimension: "ROWS", values: [input && typeof input === "object" && !Array.isArray(input) ? Object.values(input as Record<string, unknown>) : Array.isArray(input) ? input : [input]] }`
  }
  const encodeGmail = entry.id === "gmail.send" ? `\n  encodeGmail: true,` : ""
  return [
    ...(cf ? [cf] : []),
    `const raw = await runConnectAction({`,
    `  actionId: ${JSON.stringify(id)},`,
    `  provider: ${JSON.stringify(entry.provider)},`,
    `  endpoint: ${JSON.stringify(endpoint)},`,
    `  method: ${JSON.stringify(entry.method)},`,
    `  connectionId: process.env.NANGO_CONNECTION_ID ?? "",${encodeGmail}`,
    `  body: ${bodyExpr},`,
    `});`,
  ].join("\n")
}

export function exportConnectStepBodyTs(m: PipelineModule, outTs: string): string {
  const id = m.connectActionId?.trim() ?? ""
  const entry = getConnectAction(id)
  const label = entry?.displayName ?? id ?? "connect"
  const call = exportConnectCallTs(m)
  if (call.startsWith("throw ")) {
    return [`// connect ${JSON.stringify(label)}`, call].join("\n")
  }
  return [
    `// connect ${JSON.stringify(label)} — live call via Nango; testing pins this step`,
    call,
    `return raw as unknown as ${outTs};`,
  ].join("\n")
}

export function exportConnectStepBodyPy(m: PipelineModule, outPy: string): string {
  const id = m.connectActionId?.trim() ?? ""
  return [
    `# connect ${JSON.stringify(id)} — Nango proxy; set NANGO_SECRET_KEY / NANGO_HOST`,
    `raise NotImplementedError("connect steps run via Nango in the TypeScript export")  # ${outPy}`,
  ].join("\n")
}

export function exportConnectStepBodyGo(m: PipelineModule, zero: string): string {
  const id = m.connectActionId?.trim() ?? ""
  return [
    `// connect ${JSON.stringify(id)} — Nango proxy in TypeScript export`,
    `return ${zero}, fmt.Errorf("connect steps run via Nango in the TypeScript export")`,
  ].join("\n")
}

export function exportConnectStepBodyRust(m: PipelineModule): string {
  const id = m.connectActionId?.trim() ?? ""
  return [
    `// connect ${JSON.stringify(id)} — Nango proxy in TypeScript export`,
    `Err(anyhow::anyhow!("connect steps run via Nango in the TypeScript export"))`,
  ].join("\n")
}
