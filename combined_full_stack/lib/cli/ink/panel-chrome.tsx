// AI : shared TUI chrome — area tab bar + window header annotations (parity with the full UI).

import { Box, Text } from "ink"
import {
  TUI_AREAS,
  TUI_TAB_HOTKEY,
  TUI_TAB_META,
  areaForTuiTab,
  tabsInTuiArea,
  type TuiTab,
} from "@/lib/core/view"

export function AreaTabBar({ tab }: { tab: TuiTab }) {
  const area = areaForTuiTab(tab)
  return (
    <Box flexDirection="column">
      <Box>
        {TUI_AREAS.map((a) => (
          <Text key={a.id} color={a.id === area ? "cyan" : undefined} inverse={a.id === area} dimColor={a.id !== area}>
            {` ${a.label} `}
          </Text>
        ))}
      </Box>
      <Box flexWrap="wrap">
        {tabsInTuiArea(area).map((t) => (
          <Text key={t} color={t === tab ? "cyan" : undefined} inverse={t === tab}>
            {` ${TUI_TAB_HOTKEY[t]}:${t} `}
          </Text>
        ))}
      </Box>
    </Box>
  )
}

export function PanelHeader({ tab }: { tab: TuiTab }) {
  const meta = TUI_TAB_META[tab]
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text>
        <Text bold>{meta.title}</Text>
        <Text dimColor>  {meta.step}</Text>
      </Text>
      <Text dimColor>{meta.description}</Text>
    </Box>
  )
}
