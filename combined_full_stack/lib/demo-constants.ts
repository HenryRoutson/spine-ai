import type { ProjectId } from "@/lib/types";
import { LEGAL } from "@shared/legal/site";

// AI : shared between /demo client page and public demo APIs.
export const DEMO_DEFAULT_PROJECT_ID = "p_legal" as ProjectId;

// AI : fake account shown in Settings during landing-page preview — not a real auth user.
export const DEMO_ACCOUNT_EMAIL = LEGAL.contactEmail;

export const DEMO_PROJECT_IDS: readonly ProjectId[] = [
  "p_legal" as ProjectId,
  "p_procurement_match" as ProjectId,
  "p_content_ops_n8n" as ProjectId,
  "p_csv_triage_n8n" as ProjectId,
  "p_lead_enrich_n8n" as ProjectId,
];
