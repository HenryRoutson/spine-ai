import { captureThrownError, formatErrorForClipboard } from "./error-copy";
import { InputType } from "./types";
import type { DocId, DocRef, ModuleId, PipelineModule, Project, StructureModel, TypeAlias } from "./types";
import { isUnavailableSeedDoc, looksLikeUnavailableSeedDoc } from "./seed-doc";
import { isBuiltinDocumentModel } from "@/lib/server/builtin_models";
import { stepOutputTypeName, validateStepOutput } from "@/lib/server/structure";
import { stepEmitsList } from "@/lib/server/type_expr";
import {
  exclusionReasonForInputModule,
  inputNameRestrictionLabel,
  inputTypeLabel,
  inputTypesForModule,
  orderedInputModules,
  type InputDocExclusionReason,
  type InputDocsAssignment,
} from "./inference-input";

export interface InferenceInputIssue {
  moduleId: ModuleId;
  docName: string;
  message: string;
  inputLabel?: string;
  stack?: string;
  contentLength?: number;
}

function assignmentIssueMessage(
  reason: InputDocExclusionReason,
  inputModule: PipelineModule,
): string {
  if (reason === "wrong-type") {
    return `expected ${inputTypeLabel(inputModule.inputType)} document for this input step`;
  }
  const required = inputNameRestrictionLabel(inputModule);
  return `filename must contain "${required ?? ""}"`;
}

export function validateInferenceDocAssignment(
  inputModule: PipelineModule,
  doc: DocRef,
): InferenceInputIssue | undefined {
  const reason = exclusionReasonForInputModule(doc, inputModule);
  if (!reason) return undefined;
  return {
    moduleId: inputModule.id,
    docName: doc.name,
    inputLabel: inputModule.label,
    message: assignmentIssueMessage(reason, inputModule),
  };
}

export type InferenceStructCtx = {
  models: StructureModel[]
  typeAliases?: TypeAlias[]
}

function validateJsonInputSpine(
  inputModule: PipelineModule,
  doc: DocRef,
  parsed: unknown,
  structs: InferenceStructCtx,
): InferenceInputIssue | undefined {
  const outId = inputModule.outStructureId
  if (!outId) return undefined
  const model = structs.models.find((m) => m.id === outId)
  if (!model || isBuiltinDocumentModel(model)) return undefined
  const isList = stepEmitsList(inputModule)
  const check = validateStepOutput(parsed, model, structs.models, {
    isList,
    typeAliases: structs.typeAliases ?? [],
    // AI : file JSON must match list[T] vs T exactly — LLM list coerce unwraps {jobs:[]} wrappers.
    coerceList: false,
  })
  if (check.ok) return undefined
  return {
    moduleId: inputModule.id,
    docName: doc.name,
    inputLabel: inputModule.label,
    message: `expected ${stepOutputTypeName(model.name, isList)}: ${check.error}`,
  }
}

// AI : pre-run check — blocks inference when a seed placeholder or bad JSON would blow up custom-code JSON.parse.
export function validateInferenceDocContent(
  inputModule: PipelineModule,
  doc: DocRef,
  content: string,
  structs?: InferenceStructCtx,
): InferenceInputIssue | undefined {
  if (isUnavailableSeedDoc(content, doc.name) || looksLikeUnavailableSeedDoc(content)) {
    return {
      moduleId: inputModule.id,
      docName: doc.name,
      inputLabel: inputModule.label,
      message: `seed doc missing on deploy — run sync-seeds or upload ${doc.name}`,
    };
  }
  if (doc.type === InputType.Json && inputTypesForModule(inputModule).includes(InputType.Json)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      const { message, stack } = captureThrownError(err);
      const emptyHint = content.trim() ? "" : " (document is empty)";
      return {
        moduleId: inputModule.id,
        docName: doc.name,
        inputLabel: inputModule.label,
        contentLength: content.length,
        message: `invalid JSON${emptyHint}: ${message}`,
        stack,
      };
    }
    if (structs) return validateJsonInputSpine(inputModule, doc, parsed, structs);
  }
  return undefined;
}

export function validateInferenceDocPreview(
  inputModule: PipelineModule,
  doc: DocRef,
): InferenceInputIssue | undefined {
  if (isUnavailableSeedDoc(doc.preview, doc.name) || looksLikeUnavailableSeedDoc(doc.preview)) {
    return {
      moduleId: inputModule.id,
      docName: doc.name,
      inputLabel: inputModule.label,
      message: `seed doc missing on deploy — run sync-seeds or upload ${doc.name}`,
    };
  }
  return undefined;
}

export function inferenceDocNeedsFullContent(inputModule: PipelineModule, doc: DocRef): boolean {
  return doc.type === InputType.Json && inputTypesForModule(inputModule).includes(InputType.Json);
}

export function collectInferenceInputIssues(
  inputModules: PipelineModule[],
  inputDocs: Partial<Record<ModuleId, DocRef>>,
  contentByDocId: Partial<Record<string, string>>,
  assignment?: import("./inference-input").InputDocsAssignment,
  structs?: InferenceStructCtx,
): InferenceInputIssue[] {
  const issues: InferenceInputIssue[] = [];
  const fullAssignment = assignment ?? inputDocs;
  for (const m of inputModules) {
    const docs = assignment
      ? (Array.isArray(fullAssignment[m.id])
          ? (fullAssignment[m.id] as DocRef[])
          : fullAssignment[m.id]
            ? [fullAssignment[m.id] as DocRef]
            : [])
      : inputDocs[m.id]
        ? [inputDocs[m.id]!]
        : [];
    if (!docs.length) continue;
    for (const doc of docs) {
      const assignmentIssue = validateInferenceDocAssignment(m, doc);
      if (assignmentIssue) {
        issues.push(assignmentIssue);
        continue;
      }
      const content = contentByDocId[doc.id];
      const issue =
        content !== undefined
          ? validateInferenceDocContent(m, doc, content, structs)
          : validateInferenceDocPreview(m, doc);
      if (issue) issues.push(issue);
    }
  }
  return issues;
}

export function assignmentFromSavedDocIds(
  docs: DocRef[],
  savedDocIds: Partial<Record<ModuleId, DocId | DocId[]>>,
): InputDocsAssignment {
  const out: InputDocsAssignment = {};
  for (const [moduleId, raw] of Object.entries(savedDocIds)) {
    if (!raw) continue;
    const ids = Array.isArray(raw) ? raw : [raw];
    const resolved = ids.flatMap((id) => {
      const doc = docs.find((d) => d.id === id);
      return doc ? [doc] : [];
    });
    if (!resolved.length) continue;
    out[moduleId as ModuleId] = resolved.length === 1 ? resolved[0]! : resolved;
  }
  return out;
}

export function issuesForSavedInferenceAssignment(
  project: Project,
  docs: DocRef[],
  savedDocIds: Partial<Record<ModuleId, DocId | DocId[]>>,
  contentByDocId: Partial<Record<string, string>> = {},
): InferenceInputIssue[] {
  return collectInferenceInputIssues(
    orderedInputModules(project.modules),
    {},
    contentByDocId,
    assignmentFromSavedDocIds(docs, savedDocIds),
    { models: project.models, typeAliases: project.typeAliases ?? [] },
  );
}

function issueWhereLabel(issue: InferenceInputIssue, inputModules?: PipelineModule[]): string {
  const label = issue.inputLabel ?? inputModules?.find((m) => m.id === issue.moduleId)?.label;
  return label ? `${label} · ${issue.docName}` : issue.docName;
}

export function inferenceInputIssueMessage(
  issues: InferenceInputIssue[],
  inputModules?: PipelineModule[],
): string {
  if (!issues.length) return "";
  const first = issues[0]!;
  return `${issueWhereLabel(first, inputModules)}: ${first.message}`;
}

export function inferenceInputIssueClipboard(
  issues: InferenceInputIssue[],
  uiLocation: string,
  inputModules?: PipelineModule[],
): string {
  if (!issues.length) return "";
  return issues
    .map((issue, i) =>
      formatErrorForClipboard({
        uiLocation:
          issues.length > 1 ? `${uiLocation} (issue ${i + 1}/${issues.length})` : uiLocation,
        summary: issue.message,
        context: {
          ...(issue.inputLabel ? { "Input step": issue.inputLabel } : {}),
          Document: issue.docName,
          ...(issue.contentLength !== undefined
            ? { "Content length (bytes)": String(issue.contentLength) }
            : {}),
        },
        stack: issue.stack,
      }),
    )
    .join("\n\n---\n\n");
}
