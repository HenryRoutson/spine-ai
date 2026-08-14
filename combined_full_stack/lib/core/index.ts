// AI : headless session barrel — grep "TODO (arch" in architecture-roadmap.ts for layering / duplication work.
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
  TUI_AREAS,
  TUI_TAB_HOTKEY,
  TUI_TAB_META,
  resolveTuiTab,
  tuiTabFromHotkey,
  areaForTuiTab,
  tabsInTuiArea,
} from "@/lib/core/view"
export type {
  TuiTab,
  TuiArea,
  TuiTabMeta,
  DocsView,
  TestingView,
  AgentView,
  LogsView,
  LogRunView,
  LogStepView,
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
export { SESSION_ACTIONS, SESSION_ACTION_IDS, SESSION_ACTION_PARITY_ID, TUI_COMMAND_PARITY_ID, defineAction, registerAskAgent } from "@/lib/core/actions"
export { SPINE_ACTION_ATTR, spineActionProps, renderParityMarkdownTable } from "@/lib/core/parity"
export { PARITY_ROWS, PARITY_ACTION_IDS, PARITY_LABELED_FILES, PARITY_UNLABELED_FILES } from "@/lib/core/parity-catalog"
