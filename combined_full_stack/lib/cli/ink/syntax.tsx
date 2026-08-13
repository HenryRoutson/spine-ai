// AI : tiny JSON tokenizer for Ink — logging I/O previews without a highlighter dependency.

import { Text } from "ink"

export type InkColor = "cyan" | "green" | "yellow" | "red" | "magenta" | "white" | "blue"

type Token = { text: string; color?: InkColor }

const TOKEN_RE = /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}\[\]:,])/g

export function tokenizeJsonLine(raw: string): Token[] {
  const tokens: Token[] = []
  let last = 0
  for (const match of raw.matchAll(TOKEN_RE)) {
    const idx = match.index ?? 0
    if (idx > last) tokens.push({ text: raw.slice(last, idx) })
    const [all, key, str, num, lit, punct] = match
    if (key) tokens.push({ text: key, color: "cyan" })
    else if (str) tokens.push({ text: str, color: "green" })
    else if (num) tokens.push({ text: num, color: "yellow" })
    else if (lit) tokens.push({ text: lit, color: "magenta" })
    else if (punct) tokens.push({ text: punct, color: "white" })
    else tokens.push({ text: all })
    last = idx + all.length
  }
  if (last < raw.length) tokens.push({ text: raw.slice(last) })
  return tokens.length ? tokens : [{ text: raw }]
}

export function looksLikeJson(text: string): boolean {
  const t = text.trim()
  return t.startsWith("{") || t.startsWith("[") || t.startsWith('"')
}

export function JsonInk({ value, max = 140, error = false }: { value: string; max?: number; error?: boolean }) {
  const clipped = value.length > max ? `${value.slice(0, max)}…` : value
  if (!clipped) return <Text dimColor>(empty)</Text>
  if (error) return <Text color="red">{clipped}</Text>
  if (!looksLikeJson(clipped)) return <Text dimColor>{clipped}</Text>
  return (
    <Text>
      {tokenizeJsonLine(clipped).map((tok, i) => (
        <Text key={`${i}:${tok.text.slice(0, 8)}`} color={tok.color} dimColor={!tok.color}>
          {tok.text}
        </Text>
      ))}
    </Text>
  )
}
