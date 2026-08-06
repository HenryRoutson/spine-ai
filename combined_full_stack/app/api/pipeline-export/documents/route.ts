import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { generatePipelineDocumentFiles } from "@/lib/server/pipeline_export_documents";
import type { Project } from "@/lib/server/types";

// AI : document bundle reads from disk — server route only (not client-importable).
export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;

  let project: Project;
  try {
    project = (await req.json()) as Project;
  } catch {
    return apiError("Invalid JSON body", HTTP.BAD_REQUEST);
  }

  if (!project?.modules?.length || !project?.models?.length) {
    return apiError("Project modules and models required", HTTP.BAD_REQUEST);
  }

  const files = generatePipelineDocumentFiles(project);
  return NextResponse.json(files);
}
