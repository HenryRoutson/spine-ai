// AI : TODO refactor (spec) — profit-per-user virtual table, arbitrage guard, block at -$10 not -$10.00 floor here.
// AI : shared billing thresholds — imported by server gate + client copy (keep in sync with /api/billing).
export const MIN_RUN_BALANCE_CENTS = 10;
// AI : pessimistic pre-run reservation for public invoke paths with spend limits.
export const PUBLIC_RUN_SPEND_RESERVE_CENTS = 100;
// AI : accounts may go negative from LLM usage but cannot start runs below this floor.
export const MIN_ACCOUNT_BALANCE_CENTS = -1000;
export const NEW_ACCOUNT_BALANCE_CENTS = 1000;
export const TOPUP_OPTIONS_CENTS = [100, 1000, 2000] as const;
export const SUB_CENTS_PER_MONTH = 500;
export const BILLING_CAP_CENTS = 30000;
export const FEEDBACK_CREDIT_CENTS = 100;
export const FEEDBACK_MIN_CHARS = 100;
export const FEEDBACK_MAX_CREDITS_PER_DAY = 10;
