import { confidentialUploadWarning } from "@/lib/confidential-upload";
import { prettyJsonString, tryParseJson } from "@/lib/json-utils";
import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP, MESSAGE_REQUIRED, unknownProject } from "@/lib/server/api-errors";
import { docContentBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import { linkDocToProject, deleteDocForProject } from "@/lib/server/store";
import { logger } from "@/lib/server/server_logger";
import { DocLabel, InputType } from "@/lib/server/types";
import type { DocId, ProjectId } from "@/lib/server/types";
import { inputTypeFromFilename } from "@/lib/server/upload_constants";

// AI : SECURITY — same HTML probe as validateUploadBytes for text created via JSON body.
function rejectHtmlTextContent(content: string): string | null {
  const probe = content.slice(0, 512).trimStart().toLowerCase();
  if (probe.startsWith("<!doctype html") || probe.startsWith("<html") || probe.includes("<script")) {
    return "HTML content is not allowed in text documents";
  }
  return null;
}

const apiLog = logger("api:docs-content");

type ValidatedDocContent = {
  name: string;
  type: InputType;
  content: string;
  label: DocLabel;
  projectId?: ProjectId;
  replaceDocId?: DocId;
};

function validateDocContent(body: {
  name: string;
  type?: InputType;
  content: string;
  label?: DocLabel;
  projectId?: string;
  replaceDocId?: string;
}): NextResponse | ValidatedDocContent {
  const content = body.content;
  if (!content.trim()) return apiError(MESSAGE_REQUIRED, HTTP.BAD_REQUEST);
  const confidentialBlock = confidentialUploadWarning(body.name);
  if (confidentialBlock) return apiError(confidentialBlock, HTTP.FORBIDDEN);

  const inferred = inputTypeFromFilename(body.name);
  const type = body.type ?? inferred;
  if (type !== InputType.Text && type !== InputType.Json) {
    return apiError("only text and json documents can be created from content", HTTP.BAD_REQUEST);
  }
  if (type !== inferred && !(type === InputType.Text && (body.name.endsWith(".txt") || body.name.endsWith(".md")))) {
    return apiError(`filename extension does not match type "${type}"`, HTTP.BAD_REQUEST);
  }

  let normalized = content;
  if (type === InputType.Json) {
    const parsed = tryParseJson(content);
    if (!parsed.ok) return apiError(`invalid json: ${parsed.error.message}`, HTTP.BAD_REQUEST);
    normalized = prettyJsonString(content);
  } else {
    const htmlBlock = rejectHtmlTextContent(content);
    if (htmlBlock) return apiError(htmlBlock, HTTP.BAD_REQUEST);
  }

  const label: DocLabel = body.label === DocLabel.Training ? DocLabel.Training : DocLabel.Inference;
  return {
    name: body.name,
    type,
    content: normalized,
    label,
    projectId: body.projectId as ProjectId | undefined,
    replaceDocId: body.replaceDocId as DocId | undefined,
  };
}

export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const parsed = await parseRequestJson(req, docContentBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  const validated = validateDocContent(parsed);
  if (validated instanceof NextResponse) return validated;

  if (validated.projectId && !store.project(validated.projectId)) {
    return apiError(unknownProject(validated.projectId), HTTP.NOT_FOUND);
  }

  apiLog.info(`POST /api/docs/content`, {
    name: validated.name,
    type: validated.type,
    label: validated.label,
    chars: validated.content.length,
    projectId: validated.projectId,
  });

  const doc = store.addDoc(validated.name, validated.type, validated.content, validated.label);
  if (validated.projectId) {
    // AI : write new bytes first — only drop superseded row when the content hash id actually changed.
    if (validated.replaceDocId && validated.replaceDocId !== doc.id) {
      deleteDocForProject(store, validated.projectId, validated.replaceDocId);
    }
    linkDocToProject(store, validated.projectId, validated.name);
  }
  await store.flush();

  apiLog.info(`doc saved from content`, { docId: doc.id, name: validated.name });
  return NextResponse.json(doc);
}
