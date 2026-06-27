"use client"

// AI : subscribe to browser-pref change events — re-read on dispatch from storage writers.

import { useEffect, useState } from "react"

export function useBrowserPrefEvent<T>(event: string, read: () => T): T {
  const [value, setValue] = useState(read)
  useEffect(() => {
    const onChange = () => setValue(read())
    window.addEventListener(event, onChange)
    return () => window.removeEventListener(event, onChange)
  }, [event, read])
  return value
}

export function useRerenderOnEvent(event: string): void {
  const [, bump] = useState(0)
  useEffect(() => {
    const onChange = () => bump((n) => n + 1)
    window.addEventListener(event, onChange)
    return () => window.removeEventListener(event, onChange)
  }, [event])
}
