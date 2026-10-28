"use client"

import { useCallback, useRef } from "react"
import { cancelRun } from "@/lib/run-engine"
import type { RunJobId } from "@/lib/types"

export function isRunAbortedError(err: unknown): err is DOMException {
  return err instanceof DOMException && err.name === "AbortError"
}

// AI : shared abort + server cancel — begin() returns the signal, trackJobId() after startRun.
export function useCancellableRun() {
  const abortRef = useRef<AbortController | null>(null)
  const jobIdRef = useRef<RunJobId | null>(null)

  const begin = useCallback(() => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    jobIdRef.current = null
    return ac.signal
  }, [])

  const trackJobId = useCallback((jobId: RunJobId) => {
    jobIdRef.current = jobId
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    const jobId = jobIdRef.current
    if (jobId) void cancelRun(jobId).catch(console.error)
  }, [])

  const clear = useCallback(() => {
    abortRef.current = null
    jobIdRef.current = null
  }, [])

  return { begin, trackJobId, stop, clear }
}

// AI : parallel keyed runs (e.g. one test file each) share the same stop/cancel wiring.
export function useCancellableRunRegistry<K>() {
  const abortByKey = useRef(new Map<K, AbortController>())
  const jobIdByKey = useRef(new Map<K, RunJobId>())

  const begin = useCallback((key: K) => {
    abortByKey.current.get(key)?.abort()
    const ac = new AbortController()
    abortByKey.current.set(key, ac)
    jobIdByKey.current.delete(key)
    return ac.signal
  }, [])

  const trackJobId = useCallback((key: K, jobId: RunJobId) => {
    jobIdByKey.current.set(key, jobId)
  }, [])

  const stop = useCallback((key: K) => {
    abortByKey.current.get(key)?.abort()
    const jobId = jobIdByKey.current.get(key)
    if (jobId) void cancelRun(jobId).catch(console.error)
  }, [])

  const stopAll = useCallback(() => {
    for (const ac of abortByKey.current.values()) ac.abort()
    for (const jobId of jobIdByKey.current.values()) {
      void cancelRun(jobId).catch(console.error)
    }
  }, [])

  const clear = useCallback((key: K) => {
    abortByKey.current.delete(key)
    jobIdByKey.current.delete(key)
  }, [])

  return { begin, trackJobId, stop, stopAll, clear }
}
