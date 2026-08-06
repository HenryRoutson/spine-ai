-- AI : RunStep.codeProfile lives in public.runs.data (jsonb) per step — no column change.
-- AI : Shape: { code: string, language: "typescript"|"python", lineMs: Record<string, number> }
-- AI : Written when browser custom-code/assert steps submit client-step with line timings.

comment on table public.runs is
  'Pipeline run history. runs.data PipelineRun.steps[].codeProfile stores persisted custom-code line profiles for Logging.';
