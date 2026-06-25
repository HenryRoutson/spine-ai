// AI : shared assistant route validation and project lookup.

import { NextResponse } from "next/server"
import { ASSISTANT_HISTORY_LIMIT } from "@/lib/assistant-chat-types"
import { apiError } from "./api_context"
import { HTTP, MESSAGE_REQUIRED, unknownProject } from "./api-errors"
import type { ChatTurn } from "./assistant-shared"
import type { ModelId, Project, ProjectId } from "./types"
import type { Store } from "./store"

export { ASSISTANT_HISTORY_LIMIT }

export type AssistantRequestBody = {
  projectId: ProjectId
  message: string
  history?: ChatTurn[]
  model?: ModelId
  stream?: boolean
}

export function trimAssistantHistory(history: ChatTurn[]): ChatTurn[] {
  return history.slice(-ASSISTANT_HISTORY_LIMIT)
}

export function requireAssistantMessage(message: string | undefined): NextResponse | null {
  if (!message?.trim()) return apiError(MESSAGE_REQUIRED, HTTP.BAD_REQUEST)
  return null
}

export function requireProjectOr404(
  store: Store,
  projectId: ProjectId,
  log: { warn: (msg: string, ctx?: Record<string, unknown>) => void },
): Project | NextResponse {
  const project = store.project(projectId)
  if (!project) {
    log.warn(`unknown project`, { projectId })
    return apiError(unknownProject(projectId), HTTP.NOT_FOUND)
  }
  return project
}
