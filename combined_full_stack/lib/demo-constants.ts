import type { ProjectId } from "@/lib/types";

// AI : shared between /demo client page and public demo APIs.
export const DEMO_DEFAULT_PROJECT_ID = "p_legal" as ProjectId;

export const DEMO_PROJECT_IDS: readonly ProjectId[] = [
  "p_legal" as ProjectId,
  "p_procurement_match" as ProjectId,
];
