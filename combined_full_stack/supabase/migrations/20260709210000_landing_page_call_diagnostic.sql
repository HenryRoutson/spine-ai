-- AI : full landing-run diagnostics — denormalized text + JSON for reconstruction (output_preview stays short).

alter table public.landing_page_calls
  add column if not exists diagnostic_text text,
  add column if not exists diagnostic_json jsonb;
