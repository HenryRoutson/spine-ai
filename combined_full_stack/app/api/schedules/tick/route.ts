import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate_limit";
import type { RateLimitKey } from "@/lib/rate_limit_config";
import {
  claimDueSchedules,
  markRuntimeTicked,
  verifyTickSecret,
} from "@/lib/server/pipeline_schedules";
import { queueScheduledRun } from "@/lib/server/pipeline_schedule_run";
import { logger } from "@/lib/server/server_logger";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const tickLog = logger("api:schedules:tick");

function bearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim();
}

export async function POST(req: NextRequest) {
  const secret = bearerToken(req);
  if (!secret) return apiError("Authorization: Bearer required", HTTP.UNAUTHORIZED);
  const ok = await verifyTickSecret(secret);
  if (!ok) return apiError("Invalid tick secret", HTTP.UNAUTHORIZED);

  const ip = clientIpFromHeaders(req.headers);
  const limited = await checkRateLimit(`cron-tick:${ip}` as RateLimitKey, "cron_tick");
  if (!limited.ok) {
    return apiError("Too many tick requests", HTTP.TOO_MANY_REQUESTS, "rate_limited");
  }

  await markRuntimeTicked();
  const due = await claimDueSchedules();
  const started: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const row of due) {
    try {
      const result = await queueScheduledRun(row);
      if (result.ok) started.push(result.jobId);
      else failed.push({ id: row.id, error: result.message });
    } catch (err) {
      tickLog.error(`tick run failed`, { id: row.id, error: (err as Error).message });
      failed.push({ id: row.id, error: (err as Error).message });
    }
  }
  return NextResponse.json({ claimed: due.length, started: started.length, failed });
}
