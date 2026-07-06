import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { parseRequestJson } from "@/lib/server/api_schemas";
import {
  CreatorEarningsError,
  withdrawCreatorEarningsToCredit,
} from "@/lib/server/creator_earnings";
import { logger } from "@/lib/server/server_logger";

const apiLog = logger("api:billing:earnings-withdraw");

const withdrawBodySchema = z
  .object({
    cents: z.number().positive().max(1_000_000),
  })
  .strict();

export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore("billing");
  if (ctx instanceof NextResponse) return ctx;

  const parsed = await parseRequestJson(req, withdrawBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);

  try {
    const result = await withdrawCreatorEarningsToCredit(ctx.auth.userId, parsed.cents);
    apiLog.info(`withdraw ok`, {
      userId: ctx.auth.userId,
      cents: parsed.cents,
      earningsBalanceAfter: result.earnings.balanceCents,
    });
    return NextResponse.json({
      ok: true,
      earningsBalanceCents: result.earnings.balanceCents,
      creditBalanceCents: result.creditBalanceCents,
    });
  } catch (err) {
    if (err instanceof CreatorEarningsError) {
      return apiError(err.message, 402, err.code);
    }
    throw err;
  }
}
