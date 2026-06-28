import { confidentialUploadWarning } from "@/lib/confidential-upload";
import { prettyJsonString, tryParseJson } from "@/lib/json-utils";
import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP, MESSAGE_REQUIRED } from "@/lib/server/api-errors";
import { linkDocToProject } from "@/lib/server/store";
import { logger } from "@/lib/server/server_logger";
import type { DocLabel, InputType, ProjectId } from "@/lib/server/types";
import { inputTypeFromFilename } from "@/lib/server/upload_constants";

const apiLog = logger("api:docs-content");

const MAX_CONTENT_CHARS = 32_000;

type DocContentBody = {
  name?: string;
  type?: InputType;
  content?: string;
  label?: DocLabel;
  projectId?: ProjectId;
};

function validateDocContent(body: DocContentBody): NextResponse | { name: string; type: InputType; content: string; label: DocLabel; projectId?: ProjectId } {
  const name = body.name?.trim();
  const content = body.content;
  if (!name) return apiError("missing name", HTTP.BAD_REQUEST);
  if (content == null || !content.trim()) return apiError(MESSAGE_REQUIRED, HTTP.BAD_REQUEST);
  if (content.length > MAX_CONTENT_CHARS) {
    return apiError(`content too large (max ${MAX_CONTENT_CHARS} chars)`, HTTP.BAD_REQUEST);
  }
  const confidentialBlock = confidentialUploadWarning(name);
  if (confidentialBlock) return apiError(confidentialBlock, HTTP.FORBIDDEN);

  const inferred = inputTypeFromFilename(name);
  const type = body.type ?? inferred;
  if (type !== "text" && type !== "json") {
    return apiError("only text and json documents can be created from content", HTTP.BAD_REQUEST);
  }
  if (type !== inferred && !(type === "text" && (name.endsWith(".txt") || name.endsWith(".md")))) {
    return apiError(`filename extension does not match type "${type}"`, HTTP.BAD_REQUEST);
  }

  let normalized = content;
  if (type === "json") {
    const parsed = tryParseJson(content);
    if (!parsed.ok) return apiError(`invalid json: ${parsed.error.message}`, HTTP.BAD_REQUEST);
    normalized = prettyJsonString(content);
  }

  const label: DocLabel = body.label === "training" ? "training" : "inference";
  return { name, type, content: normalized, label, projectId: body.projectId };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as DocContentBody;
  const validated = validateDocContent(body);
  if (validated instanceof NextResponse) return validated;

  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  apiLog.info(`POST /api/docs/content`, {
    name: validated.name,
    type: validated.type,
    label: validated.label,
    chars: validated.content.length,
    projectId: validated.projectId,
  });

  const doc = store.addDoc(validated.name, validated.type, validated.content, validated.label);
  if (validated.projectId) linkDocToProject(store, validated.projectId, validated.name);
  await store.flush();

  apiLog.info(`doc saved from content`, { docId: doc.id, name: validated.name });
  return NextResponse.json(doc);
}
