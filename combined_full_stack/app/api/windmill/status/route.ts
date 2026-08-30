import { NextResponse } from "next/server";
import { windmillConfigured } from "@/lib/windmill/config";

// AI : tells the UI whether WINDMILL_URL + WINDMILL_TOKEN are set — never returns the token.
export async function GET() {
  return NextResponse.json({ configured: windmillConfigured() });
}
