// AI : Hosted-app SQL — grep "TODO (app-sql" / "DONE (app-sql".
// Plan: pipelines are the backend of a hosted (Lovable) page. Buttons run a bound
// pipeline that reads/writes app_sql_rows (Postgres). Demo: shared_number starts at 1,
// everyone has a Double button. Do NOT invent a second database product.

export {}

// ---------------------------------------------------------------------------
// P0 — SQL store + sql step + hosted action/sql slots
// ---------------------------------------------------------------------------
// AI : DONE (app-sql-P0-store) — app_sql_rows (scope + table + pk + jsonb); file fallback for JsonStore
// AI : DONE (app-sql-P0-step) — ModuleKind.Sql; SELECT/UPDATE/INSERT subset; seed rows on empty table
// AI : DONE (app-sql-P0-slots) — {{sql:table}} live rows, {{action}} runs the bound pipeline
// AI : DONE (app-sql-P0-demo) — Double Shared Number seed: UPDATE … SET value = value * 2
