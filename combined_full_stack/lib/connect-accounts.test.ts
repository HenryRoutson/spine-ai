import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  listRememberedConnectAccounts,
  rememberConnectAccount,
  shortConnectAccountLabel,
} from "@/lib/connect-accounts"

function installMemoryStorage(): Map<string, string> {
  const store = new Map<string, string>()
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    },
  })
  return store
}

beforeEach(() => {
  installMemoryStorage()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("connect accounts", () => {
  it("shortens ids longer than 14 characters", () => {
    expect(shortConnectAccountLabel("abcdefghijklmn")).toBe("abcdefghijklmn")
    expect(shortConnectAccountLabel("abcdefghijklmno")).toBe("abcdefgh…")
  })

  it("ignores blank ids and providers", () => {
    rememberConnectAccount("slack", "  ")
    rememberConnectAccount("", "conn_1")
    expect(listRememberedConnectAccounts("slack")).toEqual([])
  })

  it("remembers newest-first and dedupes the same provider+id", () => {
    rememberConnectAccount("slack", "conn_old")
    rememberConnectAccount("slack", "conn_new")
    rememberConnectAccount("slack", "conn_old")
    expect(listRememberedConnectAccounts("slack")).toEqual(["conn_old", "conn_new"])
  })

  it("keeps providers isolated", () => {
    rememberConnectAccount("slack", "s1")
    rememberConnectAccount("gmail", "g1")
    expect(listRememberedConnectAccounts("slack")).toEqual(["s1"])
    expect(listRememberedConnectAccounts("gmail")).toEqual(["g1"])
  })

  it("returns empty when localStorage is missing or corrupt", () => {
    vi.unstubAllGlobals()
    expect(listRememberedConnectAccounts("slack")).toEqual([])
    const store = installMemoryStorage()
    store.set("spine.connect.accounts.v1", "{not-json")
    expect(listRememberedConnectAccounts("slack")).toEqual([])
    store.set("spine.connect.accounts.v1", JSON.stringify({ id: "x" }))
    expect(listRememberedConnectAccounts("slack")).toEqual([])
    store.set("spine.connect.accounts.v1", JSON.stringify([{ id: 1, provider: "slack" }]))
    expect(listRememberedConnectAccounts("slack")).toEqual([])
  })
})
