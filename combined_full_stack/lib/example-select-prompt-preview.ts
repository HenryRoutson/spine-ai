import {
  exampleSelectStructuredPrompt,
  fillExampleSelectPrompt,
} from "@/lib/example-select-relevance"
import { analyzePromptCacheRegions } from "@/lib/prompt-cache-regions"

export type ExampleSelectPromptSegmentRole = "cached" | "per_run" | "per_candidate"

export type ExampleSelectPromptSegment = {
  role: ExampleSelectPromptSegmentRole
  text: string
  label?: string
}

const SAMPLE_DESCRIPTION =
  "Water leaked from the upstairs bathroom. The kitchen ceiling below collapsed and the timber floor is cupping."

const SAMPLE_EXAMPLES = [
  {
    id: "ex-bathroom-leak",
    title: "Upstairs bathroom leak — ceiling collapse below",
    scope_text:
      "1. Isolate water supply to upstairs bathroom.\n2. Remove collapsed plasterboard ceiling in kitchen (approx. 4m²).",
  },
  {
    id: "ex-kitchen-reno",
    title: "Kitchen cabinetry replacement only",
    scope_text: "1. Remove and dispose of existing cabinets.\n2. Supply and install new cabinetry.",
  },
] as const

const ROLE_LABEL: Record<ExampleSelectPromptSegmentRole, string> = {
  cached: "cached prefix",
  per_run: "per run",
  per_candidate: "per candidate",
}

export function exampleSelectPromptSegmentLabel(role: ExampleSelectPromptSegmentRole): string {
  return ROLE_LABEL[role]
}

export function parseExampleSelectPromptSegments(template: string): ExampleSelectPromptSegment[] {
  const segments: ExampleSelectPromptSegment[] = [
    {
      role: "cached",
      text: "Respond with ONLY a JSON value that validates against this JSON Schema:\n« relevance schema »\n\n",
      label: "JSON Schema",
    },
  ]

  const re = /(\{description\}|\{example\})/g
  for (const part of template.split(re)) {
    if (!part) continue
    if (part === "{description}") {
      segments.push({ role: "per_run", text: part, label: "{description}" })
      continue
    }
    if (part === "{example}") {
      segments.push({ role: "per_candidate", text: part, label: "{example}" })
      continue
    }
    segments.push({ role: "cached", text: part })
  }

  return segments
}

export function exampleSelectSampleCandidatePrompts(template: string): string[] {
  return SAMPLE_EXAMPLES.map((example) =>
    exampleSelectStructuredPrompt(
      fillExampleSelectPrompt(template, SAMPLE_DESCRIPTION, example),
    ),
  )
}

export function exampleSelectDesignTimeCacheRegions(template: string) {
  return analyzePromptCacheRegions(exampleSelectSampleCandidatePrompts(template))
}
