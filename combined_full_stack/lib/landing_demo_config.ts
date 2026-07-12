// AI : landing page demo limits — shared by server gate + client copy.

import type { ModelId } from "@/lib/server/types";

export const LANDING_DEMO_MODEL: ModelId = "gpt-5-mini";
export const LANDING_PAGE_BUDGET_CENTS = 5000;
export const LANDING_DEMO_MAX_PROMPT_CHARS = 2000;
export const LANDING_DEMO_PREVIEW_CHARS = 120;
export const LANDING_DEMO_MIN_BALANCE_CENTS = 1;
// AI : pessimistic pre-run reservation — closes parallel budget TOCTOU (build + example run).
export const LANDING_DEMO_RESERVE_CENTS = 75;
export const LANDING_DEMO_RUN_RESERVE_CENTS = 75;

export type landing_demo_tag = "build-pipeline" | "run-pipeline";

export const LANDING_DEMO_TAG_BUILD_PIPELINE: landing_demo_tag = "build-pipeline";
export const LANDING_DEMO_TAG_RUN_PIPELINE: landing_demo_tag = "run-pipeline";
