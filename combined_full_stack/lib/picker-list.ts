export type picker_list_tab = "pipelines" | "websites"

export function pickerListFromPathname(pathname: string): picker_list_tab | null {
  if (pathname.startsWith("/websites")) return "websites"
  if (pathname.startsWith("/projects") || pathname.startsWith("/pipelines")) return "pipelines"
  return null
}

export function pickerListFromSearch(search: string): picker_list_tab | null {
  const list = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("list")
  if (list === "websites") return "websites"
  if (list === "pipelines") return "pipelines"
  return null
}

export function isPickerEntryPath(pathname: string): boolean {
  return (
    pathname.startsWith("/projects") || pathname.startsWith("/websites") || pathname.startsWith("/pipelines")
  )
}

export function pickerHomeHref(tab: picker_list_tab): string {
  return tab === "websites" ? "/?list=websites" : "/?list=pipelines"
}

let pendingPickerList: picker_list_tab | null = null

export function writePendingPickerList(tab: picker_list_tab): void {
  pendingPickerList = tab
}

export function peekPendingPickerList(): picker_list_tab | null {
  return pendingPickerList
}

export function consumePendingPickerList(): picker_list_tab | null {
  const next = pendingPickerList
  pendingPickerList = null
  return next
}

export function readPickerList(): picker_list_tab {
  if (typeof window === "undefined") return "pipelines"
  return (
    pickerListFromPathname(window.location.pathname) ??
    pickerListFromSearch(window.location.search) ??
    "pipelines"
  )
}
