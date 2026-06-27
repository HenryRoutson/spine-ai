// AI : shared localStorage pref helpers — boolean + validated string values.

import { appStorageKey } from "@/lib/storage-keys"

type BooleanPrefDef = {
  keySuffix: string
  defaultValue: boolean
  changedEvent: string
}

export function booleanBrowserPref(def: BooleanPrefDef) {
  const key = appStorageKey(def.keySuffix)
  return {
    key,
    defaultValue: def.defaultValue,
    changedEvent: def.changedEvent,
    read(): boolean {
      if (typeof window === "undefined") return def.defaultValue
      try {
        const v = localStorage.getItem(key)
        if (v === "true") return true
        if (v === "false") return false
      } catch {
        /* ignore */
      }
      return def.defaultValue
    },
    write(value: boolean): void {
      localStorage.setItem(key, value ? "true" : "false")
      window.dispatchEvent(new Event(def.changedEvent))
    },
  }
}

type StringPrefDef<T extends string> = {
  keySuffix: string
  defaultValue: T
  changedEvent: string
  isValid: (v: string) => v is T
}

export function stringBrowserPref<T extends string>(def: StringPrefDef<T>) {
  const key = appStorageKey(def.keySuffix)
  return {
    key,
    defaultValue: def.defaultValue,
    changedEvent: def.changedEvent,
    read(): T {
      if (typeof window === "undefined") return def.defaultValue
      try {
        const v = localStorage.getItem(key)
        if (v && def.isValid(v)) return v
      } catch {
        /* ignore */
      }
      return def.defaultValue
    },
    write(value: T): void {
      localStorage.setItem(key, value)
      window.dispatchEvent(new Event(def.changedEvent))
    },
  }
}
