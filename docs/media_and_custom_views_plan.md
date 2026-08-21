# Advanced data + custom views

How to handle voice, Higgsfield-style video, 3D engineering files, and a **project-owned visualization slot** that can render and interact with any typed output.

This sits on top of [`docs/new_type_system_plan.md`](new_type_system_plan.md) and [`docs/sql_types.md`](sql_types.md). It does **not** add `audio` / `video` / `gltf` as TypeExpr kinds.

---

## Problem

Today every finished step is shown as JSON (tree / table) or a text preview:

| Surface | What it renders |
|---------|-----------------|
| Inference final output | `JsonPreviewPanel` → `json-viewer.html` iframe |
| Logging step trace | same, or `outputPreview` text |
| Documents | PDF / markup / JSON / tabular — images exist as `InputType.Image`, no audio/video/3D |
| Share / embed | the same inference UI, so the same JSON box |

The spec already asks for this: *“json, excel style viewer, or even custom visualisations like video, plots.”*

That gap is not a missing type. It is a missing **view layer**. Bytes already have a home (`document.blob` + `mime`). The UI has no registry that says “this value is a video, play it” or “this project shipped a custom canvas for this structure.”

Constraints that bite immediately:

- `InputType` is pdf / excel / word / json / text / markdown / latex / web / image. No audio, video, 3D.
- Original bytes allowlist is only `pdf, png, jpg, jpeg, webp` (`ORIGINAL_DOC_EXTS` + Supabase `doc-originals` MIME policy). Audio/video/3D never even hit disk today.
- Upload cap is 25 MB; `html` / `svg` / `js` / `wasm` are rejected (XSS). Video and CAD will exceed 25 MB and need wasm loaders.
- Webhook steps are a single HTTP call with a timeout (up to 10 min). Higgsfield (and most video/TTS APIs) are **submit → poll → download**.
- Final outputs always go through `InferenceRunOutputs` → JSON. There is no view hint on a module or model.
- Downloads (`lib/data-download.ts`) flatten JSON to CSV/XLSX. Binary media needs a file-URL download, not a table export.
- Share, marketplace, `/embed/[id]`, and Vibe observe all reuse the same `InferenceRunOutputs` stack — a builder-only player is not enough.
- Vibe / `simple` mode collapses traces to spreadsheet-like chrome. Rich media stays on the **Play** tab; it must not disappear in simple mode.
- The only “smart” extra renderer today is TikZ: `highlight.tsx` sniffs LaTeX strings and compiles via TikZJax. That is a hardcoded heuristic, not a viewer registry — do not add audio/video the same way.

---

## Principle: data vs view

Same split as TypeExpr vs SQL DDL:

| Layer | Owns | Does not own |
|-------|------|----------------|
| **Bytes** | `document(id, filename, mime, content, blob)` | How it looks |
| **Type** | TypeExpr / structure fields (`file(video)`, `ref AudioClip`, …) | Players, orbit controls, plots |
| **View** | builtin viewers + project visualizers bound to a type or field path | Storage, billing, spine validation |

Do **not** invent `TypeExprKind.Video`. Media is `file(inputTypes)` or a Document row. Metadata (duration, transcript, job id) is a normal structure.

```
spine value (JSON / doc_id)
        │
        ├─ TypeExpr          → what it is, what may connect downstream
        ├─ mime / InputType  → how bytes are stored and served
        └─ ViewBinding       → which UI mounts in inference / logging / share
```

The existing primitive to copy: `JsonViewerEmbed` — sandboxed iframe, `postMessage` load/settings/fullscreen, HTML export snapshots the iframe. Custom views should be the **same contract**, not a parallel React zoo.

The existing primitive **not** to copy: TikZ in `highlight.tsx` — string sniff → special-case component. Fine as a latex-inside-JSON convenience. New media must be **binding- or mime-driven**, or every vendor (Higgsfield, glTF, plots) becomes another regex.

---

## Layer 1 — Storage (bytes)

### Extend `InputType` (mime wrappers, not a new universe)

```ts
enum InputType {
  // existing …
  Audio = "audio",   // wav, mp3, ogg, m4a, flac
  Video = "video",   // mp4, webm, mov
  Model3d = "model3d", // gltf, glb, stl, obj; STEP/IGES via sidecar conversion
}
```

Keep the SQL story: audio/video/3D are `document.blob` + `mime`. `content` is optional (transcript, extracted text, conversion log). Same as PDF: blob is original, content is a projection.

### Upload / serve

| Change | Why |
|--------|-----|
| Allow listed media extensions in `EXT_TYPE` | picker + documents tab can accept them |
| Extend `ORIGINAL_DOC_EXTS` + bucket MIME allowlist | originals storage currently drops anything that is not pdf/png/jpg/jpeg/webp |
| Keep rejecting generic `html`/`js` as **docs** | XSS; visualizer HTML is a different store (below) |
| Raise or bypass 25 MB for media | 1080p clips and STEP files are larger; use chunked / resumable upload to the existing originals bucket |
| Signed, short-lived file URLs | `<video src>`, three.js loaders, and sandboxed iframes must not inherit session cookies |
| Optional transcode sidecar | browser-playable mp4/webm and glTF derived from STEP, stored next to the original (same `doc_id`, extra mime) |
| Download menu: original file when `doc_id` present | CSV/XLSX flatten is wrong for a clip; keep JSON envelope as a second download |

`GET /api/docs/[id]/file` already streams originals with Content-Type. Media players reuse that; do not base64 into `outputJson`.

### Generation writes documents, not giant JSON

A Higgsfield / TTS / CAD-export step **downloads bytes → `document` row → spine is `{ doc_id }`** (already the input-step pattern via `isDocReferenceOutputJson`). Metadata can ride alongside:

```ts
type MediaRef = {
  doc_id: DocId
  mime: string
  filename: string
  // optional projections
  duration_ms?: number
  width?: number
  height?: number
  transcript?: string
}
```

Builtin models (locked, like Document) beat one-off seed structs: `AudioClip`, `VideoClip`, `Model3dAsset`. Spine `outType` is `ref` those models (or `file(video)` if you only need the blob).

---

## Layer 2 — Types (envelopes)

Use the type system you already have.

| Need | TypeExpr | Notes |
|------|----------|--------|
| Raw blob input | `{ kind: "file", inputTypes: ["audio"] }` | input step filter, same as pdf/image |
| Typed clip + transcript | `{ kind: "ref", modelId: AudioClip }` | LLM/webhook can fill fields |
| Higgsfield job | `{ kind: "ref", modelId: RemoteMediaJob }` | `job_id`, `status`, `prompt`, `output: VideoClip \| null` |
| 3D + engineering attrs | `{ kind: "ref", modelId: Part3d }` | `asset: Model3dAsset`, `bom: list[BomLine]`, `tolerances: list[Tolerance]` |

Time-aligned quotes (voice): extend `quote_span` later with optional `t_start` / `t_end` (seconds), same FK to `document(id)`. Do not invent a parallel quote type. Text stays `text_quote`; the viewer seeks the audio when you click the span.

CAD semantics stay JSON. The mesh is the blob; hole specs / GD&T / layer names are structure fields. The 3D viewer **joins** them by id (same idea as lookup-embed in the type-system plan: do not flatten the mesh into JSON).

---

## Layer 3 — Viewer registry (builtin)

One resolver, used everywhere outputs appear: inference finals, logging, documents, share, HTML export.

```ts
type ViewBinding =
  | { kind: "builtin"; viewerId: BuiltinViewerId }
  | { kind: "custom"; visualizerId: string }
  | { kind: "field"; path: string } // mount the child field's view (e.g. output.video)

type BuiltinViewerId =
  | "json" | "table"
  | "markdown" | "latex" | "pdf" | "image"
  | "audio" | "video"
  | "gltf" | "stl"
  | "waveform"
  | "plot"

type ViewMatchInput = {
  typeExpr?: TypeExpr
  mime?: string
  filename?: string
  value: unknown
  binding?: ViewBinding // explicit wins
}

function resolveViewer(input: ViewMatchInput): ResolvedView
```

**Match order:** explicit `ViewBinding` on the **output step** (or structure) → mime / `InputType` → TypeExpr (`file(video)`, `ref VideoClip`) → JSON fallback.

| Builtin | Mounts when | Interaction |
|---------|-------------|-------------|
| json / table | default | existing json-viewer |
| image | png/jpeg + `InputType.Image` | existing; wire into output panel too |
| audio | wav/mp3/… | `<audio>`, optional waveform, transcript + seek |
| video | mp4/webm | `<video controls>`, poster from first frame optional |
| gltf | gltf/glb | three.js / R3F: orbit, grid, optional explode |
| stl | stl | same canvas, `STLLoader` |
| waveform | audio + want viz | peaks; click → time |
| plot | structure tagged `view: plot` or 2-col numeric table | lightweight (uPlot); not a new BI product |

Replace the hard-coded `JsonPreviewPanel` in `InferenceRunOutputs` / `StepTraceOutputPreview` with `<DataViewPanel value typeExpr binding />`. JSON remains the **fallback tab**, always available (inspector, download, tests). Media view is the default tab when matched.

Documents tab: if `doc.type` is audio/video/model3d, DocViewer grows those modes next to pdf/json — same `docFileUrl` you already use for PDFs.

---

## Layer 4 — Custom visualizer slot (the product)

This is the “customize a part of the UI to visualise and interact with any data.”

Not a second app framework. A **sandboxed HTML document** in the project that speaks the same embed protocol as `json-viewer.html`.

### Why HTML in an iframe

- You already ship and snapshot this pattern.
- Vibe / assistant can author HTML without a React build step.
- Share/embed and HTML-download keep working (clone iframe → srcdoc snapshot, same as JSON).
- Security boundary is real: custom code must not get `allow-same-origin` + parent cookies.

### Project object

```ts
type ProjectVisualizer = {
  id: string              // "vis_part_explode"
  name: string            // "Exploded BOM"
  html: string            // or DocId of a visualizer file
  inType: TypeExpr        // what it may bind to
  defaultHeightPx?: number
}
```

Stored on the project (JSON in Supabase, like modules). Files on disk for export: `visualizers/exploded_bom.html`.

**Not** uploaded as a normal document (those still reject HTML). Visualizer HTML is first-class config, like custom-code, linted/CSP’d, served only from `/visualizers/:id.html?embed`.

### Bind it

On `PipelineModule` (output step, or any step you want to preview):

```ts
view?: ViewBinding
```

On `StructureModel` (default when that type appears):

```ts
defaultView?: ViewBinding
```

Inference / logging / share all read the same binding. Author once.

### Protocol (`spine-view-v1`)

Parent → iframe:

```json
{
  "type": "spine-view:load",
  "value": { "...typed JSON..." },
  "typeExpr": { "kind": "ref", "modelId": "m_part3d" },
  "assets": [
    { "path": "asset.doc_id", "url": "https://…/api/docs/sha_…/file?token=…", "mime": "model/gltf-binary" }
  ]
}
```

Iframe → parent:

| Message | Meaning |
|---------|---------|
| `spine-view:ready` | handshake |
| `spine-view:resize` | height |
| `spine-view:select` | `{ jsonPath }` — highlight the same path in the JSON tab / logging |
| `spine-view:patch` | proposed value edit (trim audio, rotate instance). Parent applies via the same “branch off → new file” rule as JSON struct edit — never silent mutate of the store file |
| `spine-view:fullscreen` | reuse existing popup |

Builtin audio/video/3D viewers can be **the same protocol** internally (host HTML under `/viewers/video.html`) so HTML export and IDE embeds stay one path. React wrappers are optional sugar.

### Interaction model

Views are not read-only posters:

- **Select** — click a mesh / waveform region / plot point → JSON path + quote/time span.
- **Patch** — visualizer emits a typed patch; Testing / Inference “branch off” writes a new doc.
- **Controls** — orbit, mute, speed, explode slider live *inside* the iframe; they do not need spine writes.

Assistant / vibe: “add a 3D explode view for Part3d” → write `visualizers/….html` + set `defaultView` on the model. Same as writing custom-code against generated types.

### Security

- iframe: `sandbox="allow-scripts allow-downloads"` (add `allow-same-origin` only for first-party builtin viewers, never for project HTML).
- CSP: no `parent` access, no eval if we can avoid it; asset URLs only from the signed `assets[]` list.
- Do not eval user HTML in the Next.js tree.
- Visualizer files are not executable pipeline steps; they cannot call webhooks.

---

## Worked examples

### 1. Voice generation (TTS + STT)

**In**

- `InputType.Audio` upload, or webhook/custom-code that returns `AudioClip`.
- `doc-to-text` analogue: **audio-to-text** (Whisper / provider) fills `document.content` = transcript. Quote linking uses char offsets on the transcript; viewer maps offsets → timestamps if a word-timing array is stored.

**Out (TTS)**

1. LLM or transform emits `{ text, voice, format }`.
2. Webhook / remote-job to ElevenLabs (or similar) → mp3 bytes → `document` row.
3. Output step `outType: AudioClip`, `view: { kind: "builtin", viewerId: "audio" }`.

Pipeline is still linear JSON-in / JSON-out. The player is a view.

### 2. Higgsfield video

Higgsfield (and Kling, Runway, …) is an **async binary API**, not an LLM.

Do **not** stretch `ModuleKind.Webhook` into a hidden poll loop on a serverless invocation. Add a small, explicit step (name TBD: `remote-job` or webhook `mode: "poll"`):

```
submit:  POST { prompt, aspect, duration } → { job_id }
poll:    GET  until status ∈ { succeeded, failed }  (backoff, max wall clock)
fetch:   download mp4 → document blob
out:     VideoClip { doc_id, mime, duration_ms, provider: "higgsfield", job_id }
```

Runtime: reuse the **pause** machinery from human-review / chatbot — the run parks, a worker or the existing job hub polls, then resumes. Vercel request timeouts cannot own a 3-minute render.

View: builtin `video`. Share link plays the mp4 from a signed URL; JSON tab still shows the envelope.

Auth: same as webhook — `webhookAuthEnv` / provider key in project env. Optional later: n8n node as the catalog of providers (`n8n-roadmap.ts`); Higgsfield can be the first hand-rolled remote-job seed so you do not block on n8n.

### 3. 3D engineering

**Formats**

| Format | Browser | Plan |
|--------|---------|------|
| glTF / GLB | native (three.js) | first-class |
| STL / OBJ | loaders | first-class |
| STEP / IGES | not in-browser | server or wasm convert → cached glTF sidecar; original blob kept |

**Typed overlay (the actual product)**

```ts
type Part3d = {
  asset: Model3dAsset          // doc_id + format
  nodes: { id: text, name: text, bbox?: … }[]
  bom: { node_id: text, qty: int, part_no: text }[]
  notes: { node_id: text, body: markdown }[]
}
```

Builtin glTF viewer: click node → `spine-view:select` `{ jsonPath: "bom.3" }`. Custom visualizer: explode along BOM, color by tolerance, section plane.

Do not dump vertex buffers into JSON. Mesh stays blob; engineering data stays structures; view joins on `node_id` (FK-style annotation, runtime still text — same as Phase 6 of the type-system plan).

---

## Where it shows up in the UI

One panel, many hosts:

```
┌─────────────────────────────────────────┐
│ Output · Generate clip          [video] │
│ ┌─────────┬──────────┬────────────────┐ │
│ │ Play    │ JSON     │ Download       │ │
│ │ <video> │ json-    │ mp4 / json     │ │
│ │         │ viewer   │                │ │
│ └─────────┴──────────┴────────────────┘ │
└─────────────────────────────────────────┘
```

| Host | Behavior |
|------|----------|
| Inference finals | default tab = resolved view; JSON always second |
| Logging / step trace | compact player; fullscreen popup already exists |
| Documents | audio/video/3D modes in DocViewer |
| Share / marketplace / `/embed/[id]` | **same** `DataViewPanel` — `shared-run-panel`, `own-pipeline-run-panel`, `embed-run-viewer` |
| Vibe observe (`simple`) | Play tab still mounts; do not hide media behind builder-only chrome |
| HTML export | snapshot builtin + custom iframes the way JSON is snapshotted |
| Cursor / IDE embed (`IDE.md`) | `/embed/run/…/step/…` already the right URL shape |

**Authoring UI:** Pipeline output step (and Structure model header) get a “View” picker: builtin list + project visualizers whose `inType` is compatible. Assistant can set `view` in module specs the same way it sets `outType`.

---

## Async jobs (required for video / long TTS)

Human-review already pauses a run. Generalize:

```
RunStatus += parked_job
ParkedJob { stepModuleId, provider, job_id, poll_after }
```

Worker / hub: poll → on success write output + continue; on fail mark step error. Fingerprinting: cache key includes provider job inputs, not the binary.

Until that exists, only **fast** media (small TTS, already-uploaded files) should ship. Do not pretend a 60s webhook timeout is a video backend.

---

## Phases

### Phase A — Registry + media InputTypes (no generators)

- [ ] `InputType.Audio | Video | Model3d` + `EXT_TYPE` + documents picker filters
- [ ] Serve originals with correct Content-Type; signed URLs for `<video>` / three.js
- [ ] `resolveViewer` + `DataViewPanel`; swap into `InferenceRunOutputs` and `StepTraceOutputPreview`
- [ ] Builtin `audio` and `video` (native elements)
- [ ] JSON tab always available
- [ ] DocViewer modes for audio/video

### Phase B — View bindings

- [ ] `PipelineModule.view` + `StructureModel.defaultView`
- [ ] Assistant / seed schema / export
- [ ] Builtin `gltf` + `stl` (lazy-load three.js)
- [ ] Locked builtin models `AudioClip`, `VideoClip`, `Model3dAsset`

### Phase C — Custom visualizer slot

- [ ] `ProjectVisualizer` + `/visualizers/:id.html?embed`
- [ ] `spine-view-v1` postMessage (load / ready / resize / select / patch / fullscreen)
- [ ] Structure / output-step picker
- [ ] HTML export snapshot
- [ ] Vibe/assistant: “create visualizer for this model”

### Phase D — Generation + async

- [ ] `remote-job` (or webhook poll mode) + park/resume
- [ ] Higgsfield seed (submit/poll/fetch → `VideoClip`)
- [ ] TTS seed → `AudioClip`
- [ ] Audio-to-text next to doc-to-text; optional word timings → seekable quotes

### Phase E — CAD depth

- [ ] STEP → glTF sidecar (wasm or worker)
- [ ] node_id overlay + select → JSON path
- [ ] Example visualizer: explode / BOM color

Do not start at E. A + B already make “upload a clip, see a player instead of a JSON string of a url” true.

---

## Files to touch (when building)

| Area | Likely files |
|------|----------------|
| Types | `lib/server/types.ts` (`InputType`, `view?`, visualizer list), `upload_constants.ts` |
| Viewer | new `lib/data-view.ts`, `components/data-view-panel.tsx`, `public/viewers/*.html` |
| Outputs | `inference-outputs.tsx`, logging previews, `doc-viewer.tsx`, `shared-run-panel.tsx`, `own-pipeline-run-panel.tsx`, `embed-run-viewer.tsx` |
| Storage | `store.ts` (`ORIGINAL_DOC_EXTS`), `doc_original_storage.ts`, `app/api/docs/[id]/file/route.ts`, upload size / resumable, bucket MIME policy |
| Downloads | `lib/data-download.ts` — original-file path when `doc_id` present |
| Protocol | extend `@shared/json-viewer` pattern → `@shared/data-view` |
| Jobs | `lib/run-engine.ts`, new `steps/remote_job.ts`, job hub |
| Export | `lib/inference-html-export.ts`, pipeline export bundle (`visualizers/`) |
| Assistant | `assistant-prompt.ts`, module spec schema |

---

## Success criteria

1. An output typed `file(video)` or `VideoClip` **plays** in Inference, Logging, and Share — JSON is one click away, not the only view.
2. An output typed `file(audio)` plays; if a transcript exists, clicking a sentence seeks.
3. A glTF/STL in Documents and as a step output orbits in-canvas; STEP can wait for Phase E.
4. A project can attach a custom HTML visualizer to a structure; the vibe agent can author it; Share shows that UI, not a JSON dump.
5. Custom visualizer code cannot read other users’ data or parent cookies (sandbox + signed asset URLs).
6. Higgsfield (or equivalent) is a parked remote job that writes a `document` blob — not a webhook that times out, and not a base64 string in `outputJson`.
7. Tests still assert JSON / structure equality. Views are not the test oracle.

---

## What not to do

- New TypeExpr kinds per vendor (`higgsfield`, `elevenlabs`).
- Putting mp4/glb bytes in `outputJson`.
- Another TikZ-style string sniffer for URLs / `data:video` / `.glb` filenames. Bindings and mime, not regex.
- A builder-only player that Share / embed / Vibe `simple` never see.
- Mounting user HTML as a React component in the app shell.
- Blocking the run engine on a 3-minute HTTP call.
- Building a general BI/CAD suite. Builtin viewers are thin; depth lives in **project visualizers** bound to **your** types.
