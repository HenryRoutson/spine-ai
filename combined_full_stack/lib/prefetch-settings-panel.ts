import { warmSettingsAccount, warmSettingsTeams } from "@/lib/warm-settings-data"

// AI : warm the code-split Settings chunk and its API data before the user clicks the nav button.
export function prefetchSettingsPanel(): void {
  void import("@/components/settings")
  void warmSettingsTeams()
  void warmSettingsAccount()
}
