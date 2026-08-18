"use client"

import { useMemo, useState } from "react"
import { Check, AlertTriangle, FileText, BookOpen, Braces } from "lucide-react"
import { MultiLangReadonlyCodeViewer, type MultiLangCodeSource } from "@/components/code-viewer"
import { allModelsToBaml, allModelsToDts, allModelsToGo, allModelsToPydantic, allModelsToRust } from "@/lib/pydantic"
import { API_ROUTES } from "@/lib/api-routes"
import { JSON_HEADERS } from "@/lib/api-client"
import { readPipelineAssistantStream } from "@/lib/assistant-stream-read"
import { assistantRequestFailed } from "@/lib/assistant-chat-types"
import { useStore } from "@/lib/store"
import { DocLabel, ModuleKind, MODULE_META } from "@/lib/types"
import { AssistantChat, type AssistantChatMessage } from "@/components/assistant-chat"
import { UiContextChip } from "@/components/ui-context-chip"
import { Badge } from "@/components/ui/badge"
import { buildAssistantMentionOptions, uiContextRefFromDoc } from "@/lib/assistant-mentions"
import { isPreviewOnly } from "@/lib/demo-mode"
import { docLabelDisplay, docsForProject } from "@/lib/project-docs"
import { computeInvalidForUi } from "@/lib/pipeline-validity-ui"
import { invalidStepMessage } from "@/lib/validity"
import { chatOwnerLabel, useProjectAssistant, useProjectAssistantSession } from "@/lib/project-assistant-context"
import {
  PROJECT_ASSISTANT_INITIAL_MESSAGE,
  type ProjectProposal,
} from "@/lib/project-assistant-types"
import {
  formatAssistantInferenceVerdict,
  formatAssistantTestVerdict,
  resolveAssistantInferenceInputs,
  runAssistantInference,
  runAssistantTest,
} from "@/lib/assistant-run"
import { uid } from "@/lib/id"
import { useAppShell, AppWindowId } from "@/lib/app-shell"
import { cn } from "@/lib/utils"

type ProjectAssistantProps = {
  className?: string
  /** AI : open agent tab id — keeps this instance mounted while other agents run. */
  chatId: string
}

export function ProjectAssistant({ className, chatId }: ProjectAssistantProps) {
  const {
    project,
    modules,
    models,
    typeAliases,
    docs,
    runs,
    model: globalModel,
    addDoc,
    addDocContent,
    applyProjectChanges,
    setDocumentation,
    renameProject,
    refresh,
    refreshBilling,
    addRun,
    updateRunTest,
    flushPendingSave,
  } = useStore()
  const { getChatBindings, chats } = useProjectAssistantSession(
    project.id,
    PROJECT_ASSISTANT_INITIAL_MESSAGE,
  )
  const {
    chatId: resolvedChatId,
    messages,
    setMessages,
    streamingDraft,
    setStreamingDraft,
    setAssistantBusy,
    assistantBusy,
    isMine,
  } = getChatBindings(chatId)
  const {
    uiContextPins,
    pinUiContext,
    unpinUiContext,
    clearUiContextPins,
    setSelectMode,
    setOpen,
  } = useProjectAssistant()
  const { activeWindow } = useAppShell()
  // AI : Vibe vs Build — prompt awareness only; agent write power stays identical.
  const isVibe = activeWindow === AppWindowId.Vibe
  const humanSurface = isVibe ? "vibe" : "build"
  const [filesUploading, setFilesUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const projectDocs = useMemo(() => docsForProject(docs, project), [docs, project])

  // AI : paperclip → Documents + pin chip so Vibe (no Documents tab) can still attach files.
  async function handleComposerFiles(files: File[]) {
    if (!files.length || filesUploading) return
    if (isPreviewOnly()) {
      setUploadError("Uploads are disabled in preview mode.")
      return
    }
    setFilesUploading(true)
    setUploadError(null)
    try {
      for (const file of files) {
        const doc = await addDoc(file, DocLabel.Inference, project.id)
        pinUiContext(uiContextRefFromDoc(doc))
      }
    } catch (err) {
      setUploadError((err as Error).message || "Upload failed")
    } finally {
      setFilesUploading(false)
    }
  }

  const mentionIssues = useMemo(() => {
    const invalid = computeInvalidForUi(modules, models, typeAliases)
    const out: { id: string; label: string; message: string; moduleId?: string }[] = []
    for (const [moduleId, issues] of invalid) {
      const mod = modules.find((m) => m.id === moduleId)
      const stepLabel = mod?.label || MODULE_META[mod?.kind ?? ModuleKind.Input].label || "Step"
      issues.forEach((issue, issueIndex) => {
        const message = invalidStepMessage(issue, models, modules)
        // AI : kind alone can collide (e.g. multiple StructureField) — index keeps React keys / dedupe distinct.
        out.push({
          id: `invalid:${moduleId}:${issue.kind}:${issueIndex}`,
          label: `${stepLabel} · ${issue.kind}`,
          message,
          moduleId,
        })
      })
    }
    return out
  }, [modules, models, typeAliases])

  const mentionOptions = useMemo(
    () =>
      buildAssistantMentionOptions({
        modules,
        models,
        typeAliases,
        docs: projectDocs,
        issues: mentionIssues,
        runs,
      }),
    [modules, models, typeAliases, projectDocs, mentionIssues, runs],
  )

  const chatSummary =
    chats.find((c) => c.id === resolvedChatId) ?? chats.find((c) => c.id === chatId)
  const teammateLabel = chatSummary && !isMine ? chatOwnerLabel(chatSummary) : null

  function appendFollowUp(content: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: "assistant" as const,
        content,
      },
    ])
  }

  async function applyProposal(proposal: ProjectProposal) {
    if (proposal.changed.name && proposal.projectName) {
      renameProject(project.id, proposal.projectName)
    }
    if (proposal.changed.models || proposal.changed.modules || proposal.changed.typeAliases) {
      // AI : TODO (vibe-pending-compose) — same as session.applyProposal: skipped changed.models
      // AI :   keeps the live schema when the last Send was a modules-only follow-up.
      applyProjectChanges({
        ...(proposal.changed.models ? { models: proposal.models } : {}),
        ...(proposal.changed.modules ? { modules: proposal.modules } : {}),
        ...(proposal.changed.typeAliases ? { typeAliases: proposal.typeAliases } : {}),
      })
    }
    if (proposal.changed.documentation) {
      setDocumentation(proposal.documentation)
    }
    if (proposal.changed.docs) {
      for (const spec of proposal.docs) {
        await addDocContent(spec.name, spec.type, spec.content, spec.label, project.id)
      }
    }

    const actions = proposal.proposedActions ?? []
    if (!actions.length) return

    const nextModules = proposal.changed.modules ? proposal.modules : modules
    const nextProject = {
      ...project,
      modules: nextModules,
      models: proposal.changed.models ? proposal.models : models,
      typeAliases: proposal.changed.typeAliases ? proposal.typeAliases : typeAliases,
    }

    for (const action of actions) {
      if (action.type === "run_inference") {
        if (
          !window.confirm(
            "Apply done. Run the pipeline now on the default / assigned input documents?",
          )
        ) {
          continue
        }
        const resolved = resolveAssistantInferenceInputs({
          project: nextProject,
          modules: nextModules,
          docs,
          model: globalModel,
        })
        if (!resolved.ok) {
          appendFollowUp(`Could not start pipeline run: ${resolved.reason}`)
          continue
        }
        try {
          setAssistantBusy(true)
          await flushPendingSave?.()
          const { run } = await runAssistantInference({
            project: nextProject,
            modules: nextModules,
            docs,
            model: globalModel,
            inputDocs: resolved.inputDocs,
          })
          addRun(run)
          void refreshBilling()
          void refresh()
          appendFollowUp(formatAssistantInferenceVerdict(run))
        } catch (err) {
          appendFollowUp(`Pipeline run failed: ${(err as Error).message || "unknown error"}`)
        } finally {
          setAssistantBusy(false)
        }
        continue
      }

      if (action.type === "run_test") {
        const label = action.testDocName?.trim()
          ? `Run test file "${action.testDocName}" now?`
          : "Run the first *_testing.json file now?"
        if (!window.confirm(`Apply done. ${label}`)) continue
        try {
          setAssistantBusy(true)
          const result = await runAssistantTest({
            project: nextProject,
            modules: nextModules,
            docs,
            model: globalModel,
            testDocName: action.testDocName,
            flushPendingSave,
          })
          addRun(result.run)
          await updateRunTest(result.run.id, result.persistedTest).catch(console.error)
          void refreshBilling()
          void refresh()
          appendFollowUp(formatAssistantTestVerdict(result))
        } catch (err) {
          appendFollowUp(`Test run failed: ${(err as Error).message || "unknown error"}`)
        } finally {
          setAssistantBusy(false)
        }
      }
    }
  }

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <AssistantChat<ProjectProposal>
        key={chatId}
        title="Agent"
        subtitle={
          teammateLabel
            ? `${teammateLabel}'s chat · view only`
            : `${modules.length} steps · ${models.length} models · ${typeAliases.length} types · ${docs.length} docs`
        }
        showAvatars={!isVibe}
        showHeaderMeta={!isVibe}
        showDebug
        readOnly={!isMine}
        readOnlyHint={
          teammateLabel ? `View only — ${teammateLabel}'s chat. Start a new chat to reply.` : undefined
        }
        initialMessage={PROJECT_ASSISTANT_INITIAL_MESSAGE}
        placeholder="Describe… or type @ to mention steps, runs, cache, files"
        loadingLabel={(phase) =>
          phase === "retrying"
            ? "retrying…"
            : phase === "structuring"
              ? "designing project…"
              : phase === "observing"
                ? "reading runs…"
                : "thinking…"
        }
        messages={messages}
        onMessagesChange={setMessages}
        onStreamingDraftChange={setStreamingDraft}
        resumeBusy={assistantBusy}
        resumeStreamingDraft={streamingDraft}
        onLoadingChange={setAssistantBusy}
        uiContextPins={uiContextPins}
        canSendWithoutText={uiContextPins.length > 0}
        onComposerAttachmentsConsumed={clearUiContextPins}
        mentionOptions={mentionOptions}
        onMentionPick={(option) => {
          if (option.action === "select_ui") {
            // AI : setSelectMode alone does not open the dock — mirror toggleSelectMode.
            setOpen(true)
            setSelectMode(true)
            return
          }
          if (option.ref) pinUiContext(option.ref)
        }}
        onPinUiContext={pinUiContext}
        onFilesSelected={(files) => void handleComposerFiles(files)}
        filesUploading={filesUploading}
        composerAttachments={
          // AI : chips only — empty Context tip / Select UI live on dock, not in the composer.
          uiContextPins.length > 0 || uploadError ? (
            <div className="space-y-1.5 border-b border-border bg-secondary/20 px-3 py-2">
              {uploadError ? (
                <p className="font-mono text-[10px] text-destructive">{uploadError}</p>
              ) : null}
              {uiContextPins.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {uiContextPins.map((pin) => (
                    <UiContextChip key={pin.id} pin={pin} onRemove={unpinUiContext} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : undefined
        }
        onApprove={async (msg) => {
          if (!msg.proposal) return
          await applyProposal(msg.proposal)
        }}
        onReject={() => {}}
        requestAssistant={async (
          text,
          history,
          { setLoadingPhase, onThinkingDelta, onMessageDelta, onDebugEntry, uiContext },
        ) => {
          // AI : Paste chips already appear in message/history as <pasted>…</pasted> from AssistantChat.
          // AI : uiContext is snapshotted at send — don't read live pins (cleared after success).
          const pins = uiContext ?? []
          // AI : TODO (vibe-pending-compose) — POST uses live projectId; unapproved proposal on the
          // AI :   last assistant bubble is not the propose base. Follow-up Send before Approve loses schema edits.
          const res = await fetch(API_ROUTES.projectAssistant, {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify({
              projectId: project.id,
              message: text,
              history,
              model: globalModel,
              stream: true,
              humanSurface,
              ...(pins.length > 0 ? { uiContext: pins } : {}),
            }),
          })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(
              (data as { error?: string }).error ?? assistantRequestFailed(res.status),
            )
          }
          const data = await readPipelineAssistantStream<ProjectProposal>(res, {
            onThinkingDelta,
            onMessageDelta,
            onPhase: setLoadingPhase,
            onDebugEntry,
          })
          if ((data.billedCents ?? 0) > 0) {
            void refreshBilling()
            void refresh()
          }
          if (data.proposal) {
            data.proposal = {
              ...data.proposal,
              typeAliases: data.proposal.typeAliases ?? [],
              docs: data.proposal.docs ?? [],
              documentation: data.proposal.documentation ?? "",
              changed: data.proposal.changed ?? {
                modules: true,
                models: true,
                typeAliases: (data.proposal.typeAliases?.length ?? 0) > 0,
                docs: (data.proposal.docs?.length ?? 0) > 0,
                documentation: false,
                name: !!data.proposal.projectName,
                actions: (data.proposal.proposedActions?.length ?? 0) > 0,
              },
              proposedActions: data.proposal.proposedActions,
            }
          }
          return data
        }}
        renderProposal={(m) => <ProjectProposalPreview msg={m} />}
      />
    </div>
  )
}

function ProjectProposalPreview({ msg }: { msg: AssistantChatMessage<ProjectProposal> }) {
  const p = msg.proposal!
  const showModels = p.changed?.models ?? true
  const showTypeAliases = p.changed?.typeAliases ?? (p.typeAliases?.length ?? 0) > 0
  const showModules = p.changed?.modules ?? true
  const showDocs = p.changed?.docs ?? (p.docs?.length ?? 0) > 0
  const showDocumentation = p.changed?.documentation ?? false
  const showName = p.changed?.name ?? !!p.projectName
  const showActions = (p.proposedActions?.length ?? 0) > 0
  const proposalTypes = p.typeAliases ?? []
  const proposalModels = p.models ?? []

  const codeSources = useMemo<MultiLangCodeSource[]>(
    () => [
      {
        language: "python",
        label: "Python",
        filename: "models.py",
        content: allModelsToPydantic(proposalModels, proposalTypes),
      },
      {
        language: "typescript",
        label: "TypeScript",
        filename: "models.d.ts",
        content: allModelsToDts(proposalModels, proposalTypes),
      },
      {
        language: "rust",
        label: "Rust",
        filename: "models.rs",
        content: allModelsToRust(proposalModels, proposalTypes),
      },
      {
        language: "go",
        label: "Go",
        filename: "models.go",
        content: allModelsToGo(proposalModels, proposalTypes),
      },
      {
        language: "baml",
        label: "BAML",
        filename: "models.baml",
        content: allModelsToBaml(proposalModels, proposalTypes),
      },
    ],
    [proposalModels, proposalTypes],
  )

  const showCodegen = showModels || showTypeAliases

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
          Proposed changes
        </span>
        {showName && p.projectName && (
          <Badge variant="outline" className="font-mono text-[9px]">
            rename → {p.projectName}
          </Badge>
        )}
        {showModules && (
          <Badge variant="outline" className="font-mono text-[9px]">
            {p.modules.length} steps
          </Badge>
        )}
        {showModels && (
          <Badge variant="outline" className="font-mono text-[9px]">
            {proposalModels.length} models
          </Badge>
        )}
        {showTypeAliases && (
          <Badge variant="outline" className="gap-1 font-mono text-[9px]">
            <Braces className="h-2.5 w-2.5" />
            {proposalTypes.length} types
          </Badge>
        )}
        {showDocs && (
          <Badge variant="outline" className="font-mono text-[9px]">
            {p.docs.length} docs
          </Badge>
        )}
        {showDocumentation && (
          <Badge variant="outline" className="gap-1 font-mono text-[9px]">
            <BookOpen className="h-2.5 w-2.5" />
            docs tab
          </Badge>
        )}
        {showActions &&
          (p.proposedActions ?? []).map((action, i) => (
            <Badge key={`${action.type}-${i}`} variant="outline" className="font-mono text-[9px]">
              {action.type === "run_inference"
                ? "run pipeline"
                : `run test${action.testDocName ? ` · ${action.testDocName}` : ""}`}
            </Badge>
          ))}
        {msg.retryCount != null && msg.retryCount > 0 && (
          <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
            retried {msg.retryCount}×
          </Badge>
        )}
        {msg.invalidCount != null && msg.invalidCount > 0 && (
          <Badge
            variant="outline"
            className="gap-1 border-destructive/50 font-mono text-[9px] text-destructive"
          >
            <AlertTriangle className="h-2.5 w-2.5" />
            {msg.invalidCount} invalid
          </Badge>
        )}
        {msg.status === "approved" && (
          <Badge className="gap-1 font-mono text-[9px]">
            <Check className="h-3.5 w-3.5" /> applied
          </Badge>
        )}
        {msg.status === "rejected" && (
          <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
            rejected
          </Badge>
        )}
      </div>

      {msg.validationErrors && (
        <pre className="mb-2 max-h-24 overflow-auto rounded border border-destructive/30 bg-destructive/5 p-2 font-mono text-[9px] leading-relaxed whitespace-pre-wrap text-destructive">
          {msg.validationErrors}
        </pre>
      )}

      {showModels && (
        <div className="mb-3">
          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Structures
          </p>
          <ul className="space-y-1">
            {proposalModels.map((model) => (
              <li
                key={model.id}
                className="rounded border border-border/60 bg-background/50 px-2 py-1.5 font-mono text-[10px]"
              >
                <span className="text-foreground">{model.name}</span>
                <span className="text-muted-foreground"> · {model.fields.length} fields</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showTypeAliases && proposalTypes.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Types
          </p>
          <ul className="space-y-1">
            {proposalTypes.map((alias) => (
              <li
                key={alias.id}
                className="rounded border border-border/60 bg-background/50 px-2 py-1.5 font-mono text-[10px]"
              >
                <span className="text-foreground">{alias.name}</span>
                {alias.description && (
                  <span className="text-muted-foreground"> · {alias.description}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showCodegen && (
        <div className="mb-3 flex h-56 flex-col overflow-hidden rounded-md border border-border">
          <MultiLangReadonlyCodeViewer sources={codeSources} badge="preview" switchVariant="segment" />
        </div>
      )}

      {showModules && (
        <div className="mb-3">
          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Pipeline
          </p>
          <ol className="space-y-1">
            {p.modules.map((step, i) => (
              <li
                key={step.id}
                className="flex items-baseline gap-2 font-mono text-[10px] text-muted-foreground"
              >
                <span className="text-foreground/50">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-foreground">{step.label}</span>
                <span>· {MODULE_META[step.kind].label}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {showDocumentation && (
        <div className="mb-3">
          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Project documentation
          </p>
          <pre className="max-h-32 overflow-auto rounded border border-border/60 bg-background/50 p-2 font-mono text-[9px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {p.documentation.trim() || "(empty)"}
          </pre>
        </div>
      )}

      {showDocs && p.docs.length > 0 && (
        <div>
          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Test documents
          </p>
          <ul className="space-y-1">
            {p.docs.map((doc) => (
              <li
                key={doc.name}
                className="flex items-center gap-2 rounded border border-border/60 bg-background/50 px-2 py-1.5 font-mono text-[10px]"
              >
                <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate text-foreground">{doc.name}</span>
                <span className="text-muted-foreground">
                  · {docLabelDisplay(doc.label)} · {Math.round(doc.content.length / 1024)}kb
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
