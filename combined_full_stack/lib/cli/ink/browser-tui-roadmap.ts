// AI : optional GUI terminal mode — grep "TODO (opt-browser-tui" / "DONE (opt-browser-tui" for status.
//
// Not a product requirement. Header toggle like a theme switch: same useStore session,
// keyboard-first chrome that matches the Ink TUI. Default stays the visual GUI.
//
// Do NOT: run Ink in the Next bundle (yoga-layout TLA; launch.ts already spawns vite-node),
// PTY/xterm of `spine tui` (fifth host, not a skin), or import ink Box/Text into components/.
//
// Shared already: to*View (lib/core/view.ts), command catalog (commands.ts), method names
// on useStore / SpineSession. Pixels stay split — Ink for CLI, DOM twin for the browser.
// Related: arch-gui-viewmodels, arch-thin-store (architecture-roadmap.ts).
//
// Stages:
// AI : TODO (opt-browser-tui-pref) — localStorage surface "gui" | "tui" via booleanBrowserPref; skip embeds
// AI : TODO (opt-browser-tui-chrome) — AppChromeHeader trailing toggle (next to Feedback); settings optional
// AI : TODO (opt-browser-tui-shell) — app-shell-layout swaps AppWindowNav + panels for the DOM TUI
// AI : TODO (opt-browser-tui-controller) — extract prompt/hotkey/runCommand from ink/app.tsx; no Ink, no DOM
// AI : TODO (opt-browser-tui-snapshot) — map useStore fields → SessionSnapshot → toPipelineView / toLogsView / …
// AI : TODO (opt-browser-tui-view) — DOM twin of workspace-view.tsx (monospace); keep Ink file for CLI tests
// AI : TODO (opt-browser-tui-keys) — window keydown → controller when TUI focused; q/Esc returns to GUI
// AI : TODO (opt-browser-tui-mutations) — controller calls useStore (addProject, startRun, applyPendingProposal)
// AI : TODO (opt-browser-tui-vibe) — browser TUI uses /api/pipeline-assistant, not lib/cli/agent
// AI : TODO (opt-browser-tui-parity) — chrome.surface.tui row; tui.quit in-browser means leave mode, not process.exit

export {}
