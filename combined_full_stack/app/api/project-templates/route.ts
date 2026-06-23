import { NextResponse } from "next/server";
import { requireAuthStore } from "@/lib/server/api_context";
import { projectTemplateSummaries } from "@/lib/server/seed";

export async function GET() {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json({ templates: projectTemplateSummaries() });
}
