"use client"

// AI : quick-load menu — saved *_inference.json setups plus *_testing.json test inputs.

import { useEffect, useMemo, useState } from "react"
import { Check, ChevronDown, CheckSquare, Layers, Sparkles } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { docTextContent, fetchDocText } from "@/lib/doc-text-cache"
import { resolveNamedRunInputs, type NamedRunInputs } from "@/lib/inference-presets"
import {
  isInferenceSetupFileName,
  parseInferenceSetupFile,
  setupDisplayName,
} from "@/lib/inference-setup-files"
import { docsForInputModule, type InputDocsAssignment } from "@/lib/inference-input"
import { isTestingFileName, parseTestFile, TESTING_FILE_SUFFIX } from "@/lib/testing-files"
import { docsForProject } from "@/lib/project-docs"
import { cn } from "@/lib/utils"
import type { DocId, DocRef, PipelineModule, Project } from "@/lib/types"

type PresetOption = {
  id: string
  kind: "setup" | "test"
  name: string
  description?: string
  inputs: NamedRunInputs
}

function useRunPresetOptions(project: Project, docs: DocRef[]): PresetOption[] {
  const projectDocs = useMemo(() => docsForProject(docs, project), [docs, project])
  const setupDocs = useMemo(() => projectDocs.filter((d) => isInferenceSetupFileName(d.name)), [projectDocs])
  const testDocs = useMemo(() => projectDocs.filter((d) => isTestingFileName(d.name)), [projectDocs])
  const [fileContents, setFileContents] = useState<Record<DocId, string>>({})

  useEffect(() => {
    for (const d of [...setupDocs, ...testDocs]) {
      if (fileContents[d.id] !== undefined) continue
      void fetchDocText(d.id)
        .then((data) => setFileContents((prev) => ({ ...prev, [d.id]: docTextContent(data) })))
        .catch(() => setFileContents((prev) => ({ ...prev, [d.id]: "" })))
    }
  }, [setupDocs, testDocs, fileContents])

  return useMemo(() => {
    const setups: PresetOption[] = setupDocs.flatMap((d) => {
      const content = fileContents[d.id]
      if (!content) return []
      const parsed = parseInferenceSetupFile(content)
      if (!parsed.ok || !Object.keys(parsed.setup.inputs ?? {}).length) return []
      return [
        {
          id: `setup:${d.id}`,
          kind: "setup" as const,
          name: setupDisplayName(d.name),
          description: parsed.setup.description,
          inputs: parsed.setup.inputs,
        },
      ]
    })
    const tests: PresetOption[] = testDocs.flatMap((d) => {
      const content = fileContents[d.id]
      if (!content) return []
      const parsed = parseTestFile(content)
      if (!parsed.ok || !parsed.test.inputs || !Object.keys(parsed.test.inputs).length) return []
      return [
        {
          id: `test:${d.id}`,
          kind: "test" as const,
          name: d.name.slice(0, -TESTING_FILE_SUFFIX.length) || d.name,
          description: parsed.test.description,
          inputs: parsed.test.inputs,
        },
      ]
    })
    return [...setups, ...tests]
  }, [setupDocs, testDocs, fileContents])
}

function assignmentKey(assignment: InputDocsAssignment, inputModules: PipelineModule[]): string {
  return inputModules
    .map((m) => docsForInputModule(assignment, m.id).map((d) => d.id).join("+"))
    .join(",")
}

export function InferenceRunPresetMenu({
  project,
  docs,
  inputModules,
  inputDocs,
  disabled,
  onApply,
}: {
  project: Project
  docs: DocRef[]
  inputModules: PipelineModule[]
  inputDocs: InputDocsAssignment
  disabled?: boolean
  onApply: (assignment: InputDocsAssignment) => void
}) {
  const options = useRunPresetOptions(project, docs)
  const projectDocs = useMemo(() => docsForProject(docs, project), [docs, project])

  const resolved = useMemo(
    () =>
      options.map((o) => ({
        option: o,
        result: resolveNamedRunInputs(o.inputs, inputModules, projectDocs),
      })),
    [options, inputModules, projectDocs],
  )

  const currentKey = assignmentKey(inputDocs, inputModules)
  const active = resolved.find((r) => r.result.ok && assignmentKey(r.result.assignment, inputModules) === currentKey)

  if (!options.length) return null

  const setups = resolved.filter((r) => r.option.kind === "setup")
  const tests = resolved.filter((r) => r.option.kind === "test")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-foreground">{active ? active.option.name : "Load setup"}</span>
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {setups.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-mono text-[10px] uppercase text-muted-foreground">
              saved setups
            </DropdownMenuLabel>
            {setups.map(({ option, result }) => (
              <PresetMenuItem
                key={option.id}
                option={option}
                result={result}
                isActive={active?.option.id === option.id}
                icon={<Layers className="h-3.5 w-3.5 shrink-0 text-primary" />}
                onApply={onApply}
              />
            ))}
          </DropdownMenuGroup>
        )}
        {setups.length > 0 && tests.length > 0 && <DropdownMenuSeparator />}
        {tests.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-mono text-[10px] uppercase text-muted-foreground">
              from tests
            </DropdownMenuLabel>
            {tests.map(({ option, result }) => (
              <PresetMenuItem
                key={option.id}
                option={option}
                result={result}
                isActive={active?.option.id === option.id}
                icon={<CheckSquare className="h-3.5 w-3.5 shrink-0 text-primary" />}
                onApply={onApply}
              />
            ))}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PresetMenuItem({
  option,
  result,
  isActive,
  icon,
  onApply,
}: {
  option: PresetOption
  result: ReturnType<typeof resolveNamedRunInputs>
  isActive: boolean
  icon: React.ReactNode
  onApply: (assignment: InputDocsAssignment) => void
}) {
  return (
    <DropdownMenuItem
      disabled={!result.ok}
      title={result.ok ? undefined : result.error}
      onClick={() => result.ok && onApply(result.assignment)}
      className="flex items-start gap-2"
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{option.name}</span>
        {(option.description || !result.ok) && (
          <span className={cn("block truncate text-[10px]", result.ok ? "text-muted-foreground" : "text-destructive")}>
            {result.ok ? option.description : result.error}
          </span>
        )}
      </span>
      {isActive && <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />}
    </DropdownMenuItem>
  )
}
