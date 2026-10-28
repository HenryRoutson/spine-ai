import { NextResponse } from "next/server";
import { langfuseServerConfigured } from "@/lib/server/langfuse_export";

// AI : tells the UI whether server env has Langfuse keys — never returns secrets.
export async function GET() {
  return NextResponse.json({ configured: langfuseServerConfigured() });
}
