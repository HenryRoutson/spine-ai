// AI : shared billing thresholds — imported by server gate + client copy (keep in sync with /api/billing).
export const MIN_RUN_BALANCE_CENTS = 10;
// AI : accounts may go negative from LLM usage but cannot start runs below this floor.
export const MIN_ACCOUNT_BALANCE_CENTS = -1000;
