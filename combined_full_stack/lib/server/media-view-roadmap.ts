// AI : Advanced data + custom views — grep "TODO (media-view" for open work; mark DONE when a stage ships.
//
// Plan: docs/media_and_custom_views_plan.md
// Do NOT add TypeExprKind.Video / Audio / Gltf. Media is document.blob + mime (InputType).
// Views are a separate layer (builtin registry + project HTML visualizers).
// Do NOT sniff URLs like TikZ in highlight.tsx. Do NOT put mp4/glb in outputJson.
//
// Match order for a viewer:
//   PipelineModule.view | StructureModel.defaultView → mime / InputType → TypeExpr file() / envelope ref → JSON
//
// Copy: JsonViewerEmbed (iframe + postMessage). Do not mount user HTML in the Next.js tree.
//
// Product: visualization, validation, pipeline — not an integration catalog.
//   Higgsfield (and any generate API) is webhook URL + JSON paths + VideoClip, not ModuleKind.Higgsfield.

// ---------------------------------------------------------------------------
// Phase A — registry + media InputTypes (no generators)
// ---------------------------------------------------------------------------
// AI : DONE (media-view-A-types) — InputType.Audio | Video + INPUT_TYPES labels (Model3d later)
// AI : DONE (media-view-A-upload) — EXT_TYPE + picker groups; html/js still rejected
// AI : DONE (media-view-A-storage) — ORIGINAL_DOC_EXTS + bucket MIME; video/audio 80MB
// AI : DONE (media-view-A-serve) — /api/docs/[id]/file for audio/video
// AI : DONE (media-view-A-registry) — lib/data-view.ts resolveViewer + DataViewPanel (JSON always a tab)
// AI : DONE (media-view-A-players) — builtin audio + video (native elements)
// AI : DONE (media-view-A-outputs) — DataViewPanel in inference-outputs + step-trace preview
// AI : DONE (media-view-A-docs) — DocViewMode.Play + docViewerTabs / DocViewer
// AI : DONE (media-view-A-download) — DataViewPanel links original bytes when doc_id/url present.
// AI : DONE (media-view-A-share) — InferenceRunOutputs is share / embed / Vibe simple (same DataViewPanel)

// ---------------------------------------------------------------------------
// Phase B — view bindings + envelopes + 3D builtins
// ---------------------------------------------------------------------------
// AI : TODO (media-view-B-binding) — PipelineModule.view + StructureModel.defaultView (ViewBinding)
// AI : TODO (media-view-B-api) — api_schemas + seed schema allowlist view bindings
// AI : TODO (media-view-B-ui) — output-step + structure header View picker
// AI : TODO (media-view-B-assistant) — assistant-prompt / moduleSpec: set view like outType
// AI : DONE (media-view-B-envelopes) — locked builtin AudioClip / VideoClip / ImageStill
// AI : TODO (media-view-B-3d) — builtin gltf + stl (lazy three.js); mesh stays blob, not JSON vertices

// ---------------------------------------------------------------------------
// Phase C — custom visualizer slot
// ---------------------------------------------------------------------------
// AI : TODO (media-view-C-store) — Project.visualizers[]; HTML is config (not a document upload)
// AI : TODO (media-view-C-serve) — /visualizers/:id.html?embed; sandbox allow-scripts, no allow-same-origin
// AI : TODO (media-view-C-protocol) — spine-view-v1 postMessage (load/ready/resize/select/patch/fullscreen)
// AI : TODO (media-view-C-picker) — bind custom visualizer whose inType is compatible
// AI : TODO (media-view-C-export) — HTML run snapshot + zip visualizers/*.html
// AI : TODO (media-view-C-assistant) — vibe: “create visualizer for this model” writes HTML + defaultView
// AI : TODO (media-view-C-patch) — spine-view:patch → branch-off new file (never silent mutate store)

// ---------------------------------------------------------------------------
// Phase D — generation + async (Higgsfield / TTS / STT)
// ---------------------------------------------------------------------------
// AI : DONE (media-view-D-job) — webhook poll + ingest URL→document.blob. Not ModuleKind.RemoteJob.
// AI :   Not a Higgsfield/n8n catalog. Timeout is webhookTimeoutMs (in-process poll).
// AI : DONE (media-view-D-higgsfield) — seed generate_clip: raw POST → poll status_url → fetch video.url → VideoClip
// AI : TODO (media-view-D-tts) — TTS seed → AudioClip (same webhook poll/ingest; not base64 in JSON)
// AI : TODO (media-view-D-stt) — audio-to-text next to doc-to-text; optional word timings

// ---------------------------------------------------------------------------
// Phase E — CAD depth
// ---------------------------------------------------------------------------
// AI : TODO (media-view-E-step) — STEP/IGES → cached glTF sidecar; keep original blob
// AI : TODO (media-view-E-timequote) — quote_span optional t_start/t_end (seconds); click transcript seeks audio
// AI : TODO (media-view-E-overlay) — node_id join (BOM / notes) via spine-view:select { jsonPath }
// AI : TODO (media-view-E-example) — example visualizer: explode / BOM color (project HTML, not a CAD suite)

export {};
