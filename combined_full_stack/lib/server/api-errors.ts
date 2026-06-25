// AI : shared API error strings and HTTP status codes.

import type { ProjectId } from "./types"

export const HTTP = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE: 422,
  INTERNAL: 500,
  UNAVAILABLE: 503,
} as const

export const MESSAGE_REQUIRED = "message required" as const

export function unknownProject(id: ProjectId | string): string {
  return `unknown project ${id}`
}

export function unknownDoc(id: string): string {
  return `unknown doc ${id}`
}

export function unknownJob(id: string): string {
  return `unknown job ${id}`
}

export function unknownRun(id: string): string {
  return `unknown run ${id}`
}
