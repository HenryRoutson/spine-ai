export type { SessionSnapshot, ProjectCreateOpts, ProjectPatch, PersistPort, locality_t, SessionChatTurn } from "@/lib/core/types"
export { SpineSession, createSpineSession, createMemoryPersist, emptySessionSnapshot } from "@/lib/core/session"
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
export {
  toPipelineView,
  toValidationView,
  toQuoteView,
  toSessionSummary,
  toDocsView,
  toTestingView,
  toAgentView,
  toLogsView,
  toMermaidView,
  toStructureView,
  toInferenceView,
  toShareView,
  toBillingView,
  toEarningsView,
  toCacheView,
  toSettingsView,
  TUI_TABS,
  TUI_TAB_ALIASES,
  resolveTuiTab,
} from "@/lib/core/view"
export type {
  TuiTab,
  DocsView,
  TestingView,
  AgentView,
  LogsView,
  StructureView,
  InferenceView,
  ShareView,
  AccountMoneyView,
  CacheView,
  SettingsView,
} from "@/lib/core/view"
export {
  createThrowingEgress,
  createRecordingEgress,
  createApiEgress,
  EgressBlockedError,
  SPINE_API_URL_ENV,
  SPINE_API_TOKEN_ENV,
} from "@/lib/core/transport"
export { SESSION_ACTIONS, SESSION_ACTION_IDS, defineAction, registerAskAgent } from "@/lib/core/actions"
