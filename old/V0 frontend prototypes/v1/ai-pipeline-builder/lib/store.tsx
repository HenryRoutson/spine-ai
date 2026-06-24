"use client"

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react"
import type {
  PipelineModule,
  Strategy,
  StructureModel,
} from "@/lib/types"

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

interface PipelineState {
  models: StructureModel[]
  setModels: (m: StructureModel[]) => void
  modules: PipelineModule[]
  setModules: (m: PipelineModule[]) => void
  strategies: Strategy[]
  setStrategies: (s: Strategy[]) => void
}

const PipelineContext = createContext<PipelineState | null>(null)

const initialModels: StructureModel[] = [
  {
    id: "m_rule",
    name: "AtomicRule",
    description: "A single discrete obligation extracted from a legal source.",
    fields: [
      { id: uid(), name: "rule_id", type: "str", optional: false, description: "Stable identifier" },
      { id: uid(), name: "text", type: "str", optional: false, description: "Verbatim rule text" },
      { id: uid(), name: "severity", type: "int", optional: false, description: "1-5 risk weight" },
      { id: uid(), name: "tags", type: "list[str]", optional: true, description: "Topic labels" },
    ],
  },
  {
    id: "m_assessment",
    name: "ComplianceAssessment",
    description: "Result of checking a company against an atomic rule.",
    fields: [
      { id: uid(), name: "rule", type: "model", optional: false, description: "The evaluated rule", ref: "m_rule" },
      { id: uid(), name: "compliant", type: "bool", optional: false, description: "Adherence verdict" },
      { id: uid(), name: "rationale", type: "str", optional: false, description: "Justification" },
      { id: uid(), name: "liability_usd", type: "float", optional: true, description: "Estimated exposure" },
    ],
  },
]

const initialModules: PipelineModule[] = [
  { id: uid(), kind: "input", label: "Legal PDF", inputType: "pdf", cached: false, avgMs: 120, avgCostCents: 0 },
  { id: uid(), kind: "extract", label: "PDF → Text", cached: true, avgMs: 480, avgCostCents: 1 },
  { id: uid(), kind: "llm", label: "Extract Atomic Rules", structureId: "m_rule", prompt: "Split the document into atomic, independently verifiable rules.", cached: true, avgMs: 2400, avgCostCents: 18 },
  { id: uid(), kind: "input", label: "Company Outline", inputType: "word", cached: false, avgMs: 90, avgCostCents: 0 },
  { id: uid(), kind: "llm", label: "Assess Compliance", structureId: "m_assessment", prompt: "For each rule, decide whether the company complies and estimate liability.", cached: false, avgMs: 3100, avgCostCents: 26 },
  { id: uid(), kind: "validate", label: "Schema Validation", structureId: "m_assessment", cached: false, avgMs: 60, avgCostCents: 0 },
  { id: uid(), kind: "output", label: "Compliance Report", cached: false, avgMs: 40, avgCostCents: 0 },
]

const initialStrategies: Strategy[] = [
  { id: uid(), kind: "single-llm", name: "Single LLM Call", enabled: true, model: "gpt-5-mini", accuracy: 78, latencyMs: 3200, costCents: 22, passRate: 91 },
  { id: uid(), kind: "rlm", name: "Recursive LM", enabled: true, model: "claude-opus-4.6", accuracy: 89, latencyMs: 9800, costCents: 64, passRate: 97 },
  { id: uid(), kind: "claude-code", name: "Agent (Frontier)", enabled: true, model: "claude-opus-4.6", accuracy: 93, latencyMs: 28400, costCents: 210, passRate: 99 },
  { id: uid(), kind: "cheap-agent", name: "Agent (Cheap Model)", enabled: false, model: "qwen-3-coder", accuracy: 81, latencyMs: 18200, costCents: 9, passRate: 88 },
]

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [models, setModels] = useState<StructureModel[]>(initialModels)
  const [modules, setModules] = useState<PipelineModule[]>(initialModules)
  const [strategies, setStrategies] = useState<Strategy[]>(initialStrategies)

  return (
    <PipelineContext.Provider
      value={{ models, setModels, modules, setModules, strategies, setStrategies }}
    >
      {children}
    </PipelineContext.Provider>
  )
}

export function usePipeline() {
  const ctx = useContext(PipelineContext)
  if (!ctx) throw new Error("usePipeline must be used within PipelineProvider")
  return ctx
}

export { uid }
