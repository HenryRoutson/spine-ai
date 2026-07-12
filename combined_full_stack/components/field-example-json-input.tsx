"use client"

import { cn } from "@/lib/utils"

const JSON_LIKE_TOKEN_RE =
  /(\/\/[^\n]*|"(?:\\.|[^"\\])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{[\]},:])/g

function jsonLikeTokenClass(token: string): string {
  if (token.startsWith("//")) return "text-muted-foreground/70 italic"
  if (/^[{[\]},:]$/.test(token)) return "text-muted-foreground"
  if (/^"/.test(token)) return /:\s*$/.test(token) ? "text-chart-2" : "text-primary"
  if (/^(true|false|null)$/.test(token)) return "text-chart-4"
  if (/^-?\d/.test(token)) return "text-chart-3"
  return "text-foreground"
}

function splitJsonLikeText(text: string): string[] {
  return text.split(JSON_LIKE_TOKEN_RE)
}

function JsonLikeTokens({ text, muted }: { text: string; muted?: boolean }) {
  const tokens = splitJsonLikeText(text)
  return (
    <>
      {tokens.map((token, index) =>
        token ? (
          <span key={index} className={cn(jsonLikeTokenClass(token), muted && "opacity-45")}>
            {token}
          </span>
        ) : null,
      )}
    </>
  )
}

export function JsonLikeHighlight({ text, className }: { text: string; className?: string }) {
  return (
    <pre className={cn("overflow-x-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words", className)}>
      <code>
        <JsonLikeTokens text={text} />
      </code>
    </pre>
  )
}
