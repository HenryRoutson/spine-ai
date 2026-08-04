"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowRight, Lock, Plus, Trash2, X } from "lucide-react"
import {
  CODE_LANG_LABEL,
  CODE_VIEWER_LANGUAGES,
  CodeLanguageSwitch,
  MonacoCodeEditor,
  MultiLangReadonlyCodeViewer,
  type CodeViewerLanguage,
} from "@/components/code-viewer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { WindowHeader } from "@/components/window-header"
import { CodeErrorHistory, CODE_ERROR_NS } from "@/components/code-error-history"
import { recordCodeError } from "@/lib/code-error-history"
import {
  defaultCustomProviderDraft,
  listCustomLlmProviders,
  mergeCustomLlmProviders,
  removeCustomLlmProvider,
  type CustomLlmProviderDef,
  type CustomLlmProviderExportCode,
  upsertCustomLlmProvider,
  useCustomLlmProviders,
} from "@/lib/custom-llm-providers"
import { useOptionalStore } from "@/lib/store"
import { customProviderTemplate, openRouterProviderSamples } from "@/lib/llm-provider-samples"
import { validateCustomLlmProviderCode } from "@/lib/llm-provider-validate"
import { OPENROUTER_PROVIDER_ID } from "@/lib/types"
import { cn } from "@/lib/utils"

const ERROR_NS = CODE_ERROR_NS.llmProvider;

const RUNTIME_LANGUAGE: CodeViewerLanguage = "typescript";
const EXPORT_LANGUAGES = CODE_VIEWER_LANGUAGES.filter((l) => l !== RUNTIME_LANGUAGE);
type ProviderCodeTab = "runtime" | CodeViewerLanguage;

type ProviderListItem =
  | { kind: "builtin"; id: string; label: string; locked: true }
  | { kind: "custom"; id: string; label: string; locked: false };

function codeTabLabel(tab: ProviderCodeTab): string {
  if (tab === "runtime") return "TypeScript";
  return CODE_LANG_LABEL[tab];
}

function codeTabHint(tab: ProviderCodeTab): string {
  if (tab === "runtime") return "JS runtime — required";
  return "Export only — optional";
}

function pruneExportCode(exportCode: CustomLlmProviderExportCode | undefined): CustomLlmProviderExportCode | undefined {
  if (!exportCode) return undefined;
  const out: CustomLlmProviderExportCode = {};
  for (const lang of EXPORT_LANGUAGES) {
    const snippet = exportCode[lang]?.trim();
    if (snippet) out[lang] = snippet;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function CustomProviderEditor({
  initial,
  onSaved,
  onDeleted,
  onPersistProject,
}: {
  initial: CustomLlmProviderDef;
  onSaved: (def: CustomLlmProviderDef) => void;
  onDeleted?: () => void;
  onPersistProject?: (providers: CustomLlmProviderDef[]) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [codeTab, setCodeTab] = useState<ProviderCodeTab>("runtime");
  const [validation, setValidation] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initial);
    setCodeTab("runtime");
    setValidation(null);
  }, [initial.id, initial.createdAt]);

  const editorLanguage: CodeViewerLanguage =
    codeTab === "runtime" ? RUNTIME_LANGUAGE : codeTab;

  const editorValue =
    codeTab === "runtime"
      ? draft.code
      : (draft.exportCode?.[codeTab] ?? customProviderTemplate(codeTab, draft.id || "custom_provider"));

  function updateEditorValue(next: string) {
    if (codeTab === "runtime") {
      setDraft((d) => ({ ...d, code: next }));
    } else {
      setDraft((d) => ({
        ...d,
        exportCode: { ...d.exportCode, [codeTab]: next },
      }));
    }
    setValidation(null);
  }

  function save() {
    const result = validateCustomLlmProviderCode(draft.code);
    if (!result.ok) {
      recordCodeError(draft.code, result.error, ERROR_NS);
      setValidation(result.error);
      setCodeTab("runtime");
      return;
    }
    setValidation(null);
    const def: CustomLlmProviderDef = {
      ...draft,
      id: result.providerId,
      label: draft.label.trim() || result.providerId,
      exportCode: pruneExportCode(draft.exportCode),
    };
    upsertCustomLlmProvider(def);
    onPersistProject?.(mergeCustomLlmProviders(undefined, listCustomLlmProviders()));
    onSaved(def);
  }

  const codeTabs: ProviderCodeTab[] = ["runtime", ...EXPORT_LANGUAGES];

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="grid shrink-0 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Provider id</Label>
          <Input
            value={draft.id}
            onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value.trim() }))}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Label</Label>
          <Input
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            className="text-xs"
          />
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <CodeLanguageSwitch
          value={codeTab}
          onChange={setCodeTab}
          variant="pill"
          label="Code"
          options={codeTabs.map((tab) => ({
            id: tab,
            label: codeTabLabel(tab),
            title: codeTabHint(tab),
          }))}
        />
        <span className="font-mono text-[10px] text-muted-foreground">{codeTabHint(codeTab)}</span>
      </div>
      {codeTab === "runtime" && (
        <p className="shrink-0 font-mono text-[10px] text-muted-foreground">
          Required:{" "}
          <code className="text-foreground">chat(prompt, providerModel, jsonMode): Promise&lt;string&gt;</code>
        </p>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-[#1e1f23]">
        <MonacoCodeEditor
          key={`${draft.id}:${editorLanguage}`}
          value={editorValue}
          language={editorLanguage}
          onChange={updateEditorValue}
          className="min-h-0 w-full flex-1"
        />
      </div>
      {codeTab === "runtime" && <CodeErrorHistory code={draft.code} namespace={ERROR_NS} />}
      {validation && (
        <p className="shrink-0 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {validation}
        </p>
      )}
      <div className="flex shrink-0 justify-between gap-2">
        {onDeleted ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive"
            onClick={onDeleted}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        ) : (
          <span />
        )}
        <Button type="button" size="sm" onClick={save}>
          Save provider
        </Button>
      </div>
    </div>
  );
}

export function LlmProvidersSettingsPanel() {
  const builder = useOptionalStore();
  const project = builder?.project;
  const customProviders = useCustomLlmProviders(project?.llmProviders);
  const persistProjectProviders = useCallback(
    (providers: CustomLlmProviderDef[]) => {
      builder?.patchProject({ llmProviders: providers });
    },
    [builder],
  );
  const [selectedId, setSelectedId] = useState<string>(OPENROUTER_PROVIDER_ID);
  const [draftNew, setDraftNew] = useState<CustomLlmProviderDef | null>(null);

  const items: ProviderListItem[] = useMemo(
    () => [
      { kind: "builtin", id: OPENROUTER_PROVIDER_ID, label: "OpenRouter", locked: true },
      ...customProviders.map((p) => ({ kind: "custom" as const, id: p.id, label: p.label, locked: false as const })),
    ],
    [customProviders],
  );

  const selectedCustom = customProviders.find((p) => p.id === selectedId);
  const viewSources = useMemo(() => openRouterProviderSamples(), []);

  return (
    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 md:grid-cols-[12rem_minmax(0,1fr)]">
      <aside className="flex shrink-0 flex-col border-b border-border p-2 md:border-b-0 md:border-r">
        <p className="px-2 py-1 font-mono text-[10px] uppercase text-muted-foreground">Providers</p>
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  setDraftNew(null);
                  setSelectedId(item.id);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left font-mono text-[11px] transition-colors",
                  selectedId === item.id && !draftNew
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                )}
              >
                {item.locked && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
                <span className="min-w-0 truncate">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 w-full gap-1.5 text-xs"
          onClick={() => {
            setDraftNew(defaultCustomProviderDraft());
            setSelectedId("");
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add provider
        </Button>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4">
        {draftNew ? (
          <CustomProviderEditor
            initial={draftNew}
            onSaved={(def) => {
              setDraftNew(null);
              setSelectedId(def.id);
            }}
            onPersistProject={persistProjectProviders}
          />
        ) : selectedId === OPENROUTER_PROVIDER_ID ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <p className="mb-2 shrink-0 text-xs text-muted-foreground">
              TypeScript runs in Spine. Other languages are reference stubs for pipeline export.
            </p>
            <MultiLangReadonlyCodeViewer
              sources={viewSources}
              defaultLanguage="typescript"
              badge="locked example"
              switchVariant="pill"
              editorHeight="100%"
              className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-md border border-border"
            />
          </div>
        ) : selectedCustom ? (
          <CustomProviderEditor
            initial={selectedCustom}
            onSaved={() => setSelectedId(selectedCustom.id)}
            onPersistProject={persistProjectProviders}
            onDeleted={() => {
              removeCustomLlmProvider(selectedCustom.id);
              persistProjectProviders(
                mergeCustomLlmProviders(project?.llmProviders, listCustomLlmProviders()).filter(
                  (p) => p.id !== selectedCustom.id,
                ),
              );
              setSelectedId(OPENROUTER_PROVIDER_ID);
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Select a provider from the list.</p>
        )}
      </div>
    </div>
  );
}

export function LlmProvidersSettingsSummary({ onOpen }: { onOpen: () => void }) {
  const project = useOptionalStore()?.project;
  const customProviders = useCustomLlmProviders(project?.llmProviders);
  const customCount = customProviders.length;

  return (
    <section id="settings-llm-providers" className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">LLM providers</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Custom providers run TypeScript in Spine. Optional export snippets for Python, Rust, Go, and BAML.
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-xs text-muted-foreground">
          {customCount === 0
            ? "OpenRouter only"
            : `${customCount} custom provider${customCount === 1 ? "" : "s"}`}
        </span>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onOpen}>
          Open editor
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </section>
  );
}

export function LlmProvidersSettingsPage({ onClose }: { onClose: () => void }) {
  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <WindowHeader
        actions={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={close}
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        }
      />
      <LlmProvidersSettingsPanel />
    </div>,
    document.body,
  );
}
