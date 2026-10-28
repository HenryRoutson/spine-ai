"use client"

import { useEffect, useMemo, useState } from "react"

// AI : Claude Code–style status lines while pipeline inference is in flight.
const BASE_PHRASES = [
  "Warming up the models",
  "Parsing the small print",
  "Reading between the lines",
  "Cross-referencing sources",
  "Consulting the oracle",
  "Aligning token boundaries",
  "Extracting atomic rules",
  "Validating schema outputs",
  "Chasing down citations",
  "Sharpening pencils",
  "Connecting neurons",
  "Thinking harder",
  "Waiting for an inference slot",
  "Almost there",
  "Pondering the pipeline",
] as const

type wait_phrase = (typeof BASE_PHRASES)[number]

function pickNextIndex(current: number, len: number): number {
  if (len <= 1) return 0
  let next = current
  while (next === current) next = Math.floor(Math.random() * len)
  return next
}

export function useCyclingWaitPhrase(
  active: boolean,
  hints: string[] = [],
  intervalMs = 2800,
): wait_phrase | string {
  const pool = useMemo(() => {
    const extra = hints
      .map((h) => h.trim())
      .filter(Boolean)
      .map((h) => (h.endsWith("…") ? h.slice(0, -1) : h))
    return [...extra, ...BASE_PHRASES]
  }, [hints.join("\0")])

  const [index, setIndex] = useState(() => Math.floor(Math.random() * Math.max(1, pool.length)))

  useEffect(() => {
    if (!active) return
    setIndex(Math.floor(Math.random() * Math.max(1, pool.length)))
  }, [active, pool.length])

  useEffect(() => {
    if (!active || pool.length <= 1) return
    const id = window.setInterval(() => {
      setIndex((i) => pickNextIndex(i, pool.length))
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [active, pool, intervalMs])

  return pool[index % pool.length] ?? BASE_PHRASES[0]
}
