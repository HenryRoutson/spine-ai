// AI : Spine-in-Spine dogfood tests — pixel match, LoC ratios, OSS React clones, optimize loop.
// Grep: TODO (spine-in-spine-dogfood
// Catalog + types: lib/spine-in-spine-dogfood.ts
// Tracks: TODO (spine-in-spine-simple   TODO (spine-in-spine-full
//
// Vibe prompt: Implement TODO (spine-in-spine-dogfood-D1-loc)

export {}

// ---------------------------------------------------------------------------
// What "dogfood" means here
// ---------------------------------------------------------------------------
// 1. Spine-simple — rebuild Spine's product UI in 4 hosted pages. Functional,
//    not pretty. Measure authored guest LoC vs current React (~46k tsx excl. ui/).
// 2. Spine-full — pixel-identical to React AppShell at frozen scenes. Widgets
//    are the same React components in slots; chrome matches via CSS. Screenshot
//    diff is the test.
// 3. OSS clones — recreate other open-source React apps as Spine seeds. Same
//    LoC meter. This is how you *optimize*: a pattern that shows up in ≥3 clones
//    becomes a HostedSlot, then every clone's authored LoC drops.
//
// Baseline (this repo, excl. shadcn components/ui): ~225 tsx files, ~46k lines.
// Host engine (lib/**/*.ts) is NOT in the guest ratio — you are not rewriting it.

// ---------------------------------------------------------------------------
// LoC rules (or the metric lies)
// ---------------------------------------------------------------------------
// authored_guest   blueprint JSON + page HTML + custom-code TS + extra CSS
//                  + seed siteOptions. This is what a vibe-coder types.
// platform_slots   HostedTableSlot, pay/auth/run/chatbot/docs, DAG, type-expr,
//                  monaco wrappers. Amortized — counted once, not per clone.
// react_app        the original app's src (clone repo or our components/ excl ui/)
// vendor_ui        shadcn / recharts / monaco inside the original app
//
// ratio = authored_guest / react_app
// Optimize ratio down. Never move guest lines into "platform" to game it —
// a slot graduates only when ≥3 clones used the same custom HTML.
//
// Forbidden in authored_guest: generated goldens, lockfiles, node_modules,
// host run_engine, copying the original React tree into reactFiles and calling
// it a Spine app (hosted runtime:react that re-embeds the OSS source is a cheat).

// ===========================================================================
// D0 — Wire the two Spine seeds into the meter
// ===========================================================================
// AI : TODO (spine-in-spine-dogfood-D0-spine) — report rows:
// AI :   spine-simple  authored = spine_in_spine_simple.json + its HTML/CSS
// AI :                 react_app = components/**/*.tsx excluding ui/
// AI :   spine-full    authored = spine_in_spine_full.json + spine-full CSS deltas
// AI :                 (slot wrappers are platform_slots, not guest)
// AI :   Print both ratios next to OSS clones so Spine-in-Spine is dogfood #0.

// ===========================================================================
// D1 — LoC script
// ===========================================================================
// AI : TODO (spine-in-spine-dogfood-D1-loc) — scripts/spine_in_spine_loc.ts
// AI :   Input: a seed path OR an oss_clone_id.
// AI :   Count authored_guest (JSON + HTML strings + fallbackList TS + customCss).
// AI :   Count react_app (cloc or tokei on the clone checkout / our components).
// AI :   Emit loc_report JSON + a markdown table.
// AI :   npm run spine -- dogfood loc --seed spine_in_spine_simple
// AI :   Skip vendor_ui with a denylist: components/ui, node_modules, dist.

// ===========================================================================
// D2 — Pixel harness (full Spine only; simple does not pixel-match)
// ===========================================================================
// AI : TODO (spine-in-spine-dogfood-D2-pixel) — scripts/spine_in_spine_pixel.ts
// AI :   1. Boot React AppShell, load homework_grader, walk SPINE_FULL_PIXEL_SCENES.
// AI :   2. Save goldens tests/pixel/react/<scene>-<WxH>.png
// AI :   3. Boot SPINE_IN_SPINE_UI=full, same seed, same viewports.
// AI :   4. pixelmatch vs golden; fail > 0.1% (see full-F6).
// AI :   Mask: time, [data-dynamic], run ids, charts, carets.
// AI :   Playwright is already in the lockfile — don't add a second runner.
// AI : TODO (spine-in-spine-dogfood-D2-hitbox) — dump getBoundingClientRect for
// AI :   each data-spine-id; compare React vs full guest (full-F3, N=8px).

// ===========================================================================
// D3 — Clone checkout layout (OSS apps)
// ===========================================================================
// AI : TODO (spine-in-spine-dogfood-D3-checkout) — optional git clone of the
// AI :   github URL into /tmp/spine-dogfood/<id> at a pinned SHA (record SHA on
// AI :   the loc_report). Don't vendor OSS into this repo. AGPL clones stay
// AI :   outside; we publish our seed, not their source.
// AI :   source-available (n8n, tldraw): recreate UX from screenshots + public
// AI :   docs, never copy files.

// ===========================================================================
// D4 — First clone (TodoMVC) to prove the loop
// ===========================================================================
// AI : TODO (spine-in-spine-dogfood-D4-todomvc) — seeds/dogfood_todomvc.json
// AI :   structures: Todo { title text, done bool }
// AI :   pages: / with {{table:Todo}} + data-spine-id add/toggle/clear
// AI :   functions: none (or one filter function)
// AI :   Then D1 loc vs tastejs/todomvc examples/react.
// AI :   This is the calibration clone — if ratio isn't << 1, stop and fix counting.

// ===========================================================================
// D5 — Run the catalog (order)
// ===========================================================================
// AI : TODO (spine-in-spine-dogfood-D5-catalog-run) — after TodoMVC, in order:
// AI :   ai-chatbot, umami, nocodb (one table), langfuse, drawdb, calcom,
// AI :   documenso, flowise, plane (list only), windmill (run only).
// AI :   Skip negative rows except as writeups. Skip full pixel on OSS until
// AI :   Spine-full F6 is green on our own AppShell.
// AI :   Each clone = one seed under seeds/dogfood_<id>.json + a loc_report.
// AI :   Vibe prompt: "Implement clone <id> from SPINE_IN_SPINE_OSS_CLONES".

// ===========================================================================
// D6 — Optimize (the actual point of cloning others)
// ===========================================================================
// AI : TODO (spine-in-spine-dogfood-D6-optimize) — after ≥3 clones, grep guest HTML
// AI :   for repeated patterns. Graduate to a slot when 3+ clones copy the same UI:
// AI :     forms → {{form:Model}}          (react-admin, calcom, payload)
// AI :     boards → {{kanban:Model}}       (plane, twenty, refine-crm)
// AI :     charts → {{chart}}              (umami, dub, openstatus)
// AI :     DAG already planned             (flowise, langflow, n8n)
// AI :   Re-run D1 on ALL clones after each new slot. Ratio should drop.
// AI :   Record before/after in docs or the loc JSON — that's the optimization log.
// AI :   Do not add a slot for a one-off (Excalidraw canvas).

// ===========================================================================
// D7 — Anti-cheat
// ===========================================================================
// AI : TODO (spine-in-spine-dogfood-D7-anticheat) — loc script rejects a seed when:
// AI :   runtime:react reactFiles contain the original app source
// AI :   customHtml iframes the original origin
// AI :   authored_guest includes node_modules or a git submodule of the clone
// AI :   Full Spine guest mounts AppShellLayout / useStore
// AI : Pixel test rejects when guest screenshot is a browser-chrome capture of
// AI :   localhost:3000 (the React app) rather than /site/{id}.

// ===========================================================================
// D8 — Publish the scoreboard
// ===========================================================================
// AI : TODO (spine-in-spine-dogfood-D8-scoreboard) — markdown table from loc_report[]:
// AI :   clone | license | track | guest loc | react loc | ratio | notes
// AI :   Include spine-simple and spine-full as the first two rows.
// AI :   This is the pitch artifact ("NocoDB table UI in X lines"). Keep it generated.
