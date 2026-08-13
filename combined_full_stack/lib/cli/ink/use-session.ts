// AI : subscribe to the vanilla session — same snapshot React would get from useStore.

import { useSyncExternalStore } from "react"
import type { SpineSession } from "@/lib/core/session"
import type { SessionSnapshot } from "@/lib/core/types"

export function useSpineSnapshot(session: SpineSession): SessionSnapshot {
  return useSyncExternalStore(session.subscribe.bind(session), session.getSnapshot.bind(session), session.getSnapshot.bind(session))
}
