"use client"

import { Plus, Trash2 } from "lucide-react"
import { CustomCodeEditor } from "@/components/custom-code-editor"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  codeOfEntry,
  languageOfEntry,
  makeCustomCodeEntry,
} from "@/lib/custom_code_entries"
import { CustomCodeLanguage, type PipelineModule } from "@/lib/types"
import { PipelineField, StaticValue } from "@/components/pipeline-fields/shared"

type CodeModuleFieldsProps = {
  selected: PipelineModule
  edit: boolean
  onUpdate?: (patch: Partial<PipelineModule>) => void
}

export function CodeModuleFields({ selected, edit, onUpdate }: CodeModuleFieldsProps) {
  const isAssert = selected.kind === "assert"

  return (
    <PipelineField
      label={isAssert ? "Assert · step[\"Label\"] + len()" : "Code list · tried in order (first is primary)"}
      hint={
        isAssert
          ? "auto-placed after the latest referenced step label — passthrough on success"
          : undefined
      }
    >
      {edit ? (
        <div className="space-y-2">
          {(selected.fallbackList ?? []).map((fb, i) => {
            const lang = languageOfEntry(fb)
            const code = codeOfEntry(fb)
            return (
              <div key={i} className="space-y-1.5 rounded-md border border-border bg-secondary/20 p-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {i === 0 ? "primary" : `fallback ${i}`}
                  </span>
                  <Select
                    value={lang}
                    onValueChange={(v) => {
                      const next = [...(selected.fallbackList ?? [])]
                      next[i] = makeCustomCodeEntry(v as CustomCodeLanguage, code)
                      onUpdate!({ fallbackList: next })
                    }}
                  >
                    <SelectTrigger className="h-8 w-36 bg-[oklch(0.14_0.004_264)] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="typescript">TypeScript</SelectItem>
                      <SelectItem value="python">Python</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-8 w-8 text-muted-foreground"
                    disabled={(selected.fallbackList?.length ?? 0) <= 1}
                    onClick={() => {
                      const next = (selected.fallbackList ?? []).filter((_, j) => j !== i)
                      onUpdate!({ fallbackList: next })
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {lang === "python"
                    ? isAssert
                      ? "def transform(input, state=None) — len/step helpers injected"
                      : "def transform(input, state=None)"
                    : isAssert
                      ? "(input, state) => void — step/len helpers injected"
                      : "(input, state) => output"}
                </p>
                <CustomCodeEditor
                  value={code}
                  language={lang}
                  label={i === 0 ? "primary" : `fallback ${i}`}
                  onChange={(nextCode) => {
                    const next = [...(selected.fallbackList ?? [])]
                    next[i] = makeCustomCodeEntry(lang, nextCode)
                    onUpdate!({ fallbackList: next })
                  }}
                />
              </div>
            )
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              onUpdate!({
                fallbackList: [...(selected.fallbackList ?? []), makeCustomCodeEntry(CustomCodeLanguage.TypeScript, "")],
              })
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add fallback
          </Button>
        </div>
      ) : (selected.fallbackList?.length ?? 0) > 0 ? (
        <div className="space-y-2">
          {selected.fallbackList!.map((fb, i) => (
            <div key={i} className="rounded-md border border-border bg-secondary/20 p-2">
              <p className="mb-1 font-mono text-[10px] text-muted-foreground">
                {i === 0 ? "primary" : `fallback ${i}`} · {languageOfEntry(fb)}
              </p>
              <CustomCodeEditor
                value={codeOfEntry(fb)}
                language={languageOfEntry(fb)}
                readOnly
              />
            </div>
          ))}
        </div>
      ) : (
        <StaticValue>None</StaticValue>
      )}
    </PipelineField>
  )
}
