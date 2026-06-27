import type { DocRef, ModuleId, PipelineModule } from "./types";
import { isUnavailableSeedDoc, looksLikeUnavailableSeedDoc } from "./seed-doc";
import {
  exclusionReasonForInputModule,
  inputNameRestrictionLabel,
  inputTypeLabel,
  inputTypesForModule,
  type InputDocExclusionReason,
} from "./inference-input";

export interface InferenceInputIssue {
  moduleId: ModuleId;
  docName: string;
  message: string;
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
    message: assignmentIssueMessage(reason, inputModule),
  };
}

// AI : pre-run check — blocks inference when a seed placeholder or bad JSON would blow up custom-code JSON.parse.
export function validateInferenceDocContent(
  inputModule: PipelineModule,
  doc: DocRef,
  content: string,
): InferenceInputIssue | undefined {
  if (isUnavailableSeedDoc(content, doc.name) || looksLikeUnavailableSeedDoc(content)) {
    return {
      moduleId: inputModule.id,
      docName: doc.name,
      message: `seed doc missing on deploy — run sync-seeds or upload ${doc.name}`,
    };
  }
  if (doc.type === "json" && inputTypesForModule(inputModule).includes("json")) {
    try {
      JSON.parse(content);
    } catch (err) {
      return {
        moduleId: inputModule.id,
        docName: doc.name,
        message: (err as Error).message,
      };
    }
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
      message: `seed doc missing on deploy — run sync-seeds or upload ${doc.name}`,
    };
  }
  return undefined;
}

export function inferenceDocNeedsFullContent(inputModule: PipelineModule, doc: DocRef): boolean {
  return doc.type === "json" && inputTypesForModule(inputModule).includes("json");
}

export function collectInferenceInputIssues(
  inputModules: PipelineModule[],
  inputDocs: Partial<Record<ModuleId, DocRef>>,
  contentByDocId: Partial<Record<string, string>>,
  assignment?: import("./inference-input").InputDocsAssignment,
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
      const issue = content
        ? validateInferenceDocContent(m, doc, content)
        : validateInferenceDocPreview(m, doc);
      if (issue) issues.push(issue);
    }
  }
  return issues;
}

export function inferenceInputIssueMessage(issues: InferenceInputIssue[]): string {
  if (!issues.length) return "";
  const first = issues[0];
  return `${first.docName}: ${first.message}`;
}
