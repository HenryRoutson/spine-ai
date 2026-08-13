export type { SessionSnapshot, ProjectCreateOpts, ProjectPatch, PersistPort, locality_t } from "@/lib/core/types"
export { SpineSession, createSpineSession, createMemoryPersist } from "@/lib/core/session"
export {
  overlayOptimisticProjects,
  overlayOptimisticRuns,
  confirmCreatedInMap,
  TEAM_REALTIME_CHANNEL,
  TEAM_REALTIME_DEBOUNCE_MS,
  TEAM_REALTIME_TABLES,
  TEAM_REALTIME_SCHEMA,
  attachRealtimePort,
  createMemoryRealtimePort,
  subscribeTeamRealtimeChannel,
  createSupabaseRealtimePort,
  kindForRealtimeTable,
} from "@/lib/core/realtime"
export type { RealtimePort, RealtimeEvent, TeamRealtimeHandlers } from "@/lib/core/realtime"
export { toPipelineView, toValidationView, toQuoteView, toSessionSummary } from "@/lib/core/view"
export { createThrowingEgress, createRecordingEgress, EgressBlockedError } from "@/lib/core/transport"
export { SESSION_ACTIONS, SESSION_ACTION_IDS, defineAction } from "@/lib/core/actions"
