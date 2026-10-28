import { NextResponse } from "next/server";
import { getSupabasePublicEnv } from "@/utils/supabase/env";

// AI : runtime public Supabase config for the browser when static build missed env injection.
export async function GET() {
  const env = getSupabasePublicEnv();
  if (!env) {
    return NextResponse.json(
      { error: "Supabase env missing — set NEXT_PUBLIC_SUPABASE_URL and key on Vercel" },
      { status: 503 },
    );
  }
  return NextResponse.json(env, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
