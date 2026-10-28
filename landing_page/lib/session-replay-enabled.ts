// AI : same kill switch as the Spine app — default off. Landing was recording anyway and 503'd.

function parseSessionReplayEnabled(raw: string | undefined): boolean {
  if (raw == null || raw.trim() === "") return false;
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

export const SESSION_REPLAY_ENABLED = parseSessionReplayEnabled(
  process.env.NEXT_PUBLIC_SESSION_REPLAY_ENABLED ?? process.env.SESSION_REPLAY_ENABLED,
);
