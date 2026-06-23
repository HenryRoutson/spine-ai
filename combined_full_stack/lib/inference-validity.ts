import type { DocRef, ModuleId, PipelineModule } from "./types";
import { isUnavailableSeedDoc, looksLikeUnavailableSeedDoc } from "./seed-doc";
import { docNameMatchesInputModule, inputTypeLabel, inputTypesForModule } from "./inference-input";

export interface InferenceInputIssue {
  moduleId: ModuleId;
  docName: string;
  message: string;
}

export function validateInferenceDocAssignment(
  inputModule: PipelineModule,
  doc: DocRef,
): InferenceInputIssue | undefined {
  const allowed = inputTypesForModule(inputModule);
  if (allowed.length && !allowed.includes(doc.type)) {
    return {
      moduleId: inputModule.id,
      docName: doc.name,
      message: `expected ${inputTypeLabel(inputModule.inputType)} document for this input step`,
    };
  }
  const required = inputModule.inputNameContains?.trim();
  if (required && !docNameMatchesInputModule(doc, inputModule)) {
    return {
      moduleId: inputModule.id,
      docName: doc.name,
      message: `filename must contain "${required}"`,
    };
  }
  return undefined;
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
  if (inputTypesForModule(inputModule).includes("json")) {
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

export function collectInferenceInputIssues(
  inputModules: PipelineModule[],
  inputDocs: Partial<Record<ModuleId, DocRef>>,
  contentByDocId: Partial<Record<string, string>>,
): InferenceInputIssue[] {
  const issues: InferenceInputIssue[] = [];
  for (const m of inputModules) {
    const doc = inputDocs[m.id];
    if (!doc) continue;
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
  return issues;
}

export function inferenceInputIssueMessage(issues: InferenceInputIssue[]): string {
  if (!issues.length) return "";
  const first = issues[0];
  return `${first.docName}: ${first.message}`;
}
