// Generated pipeline export — equivalent Rust representation
// Project: Example Select Demo 2 1
// 14 steps · 18 structures · 1011 lines
// Setup: export also includes .env.example and README.md — copy .env.example → .env
// Cargo: serde, serde_json, tokio, reqwest, anyhow (see README.md)

// === structures ===
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteSpan {
    pub doc_id: String,
    pub start: i64,
    pub end: i64,
}

pub type Quote = QuoteSpan;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextQuote {
    pub text: String,
    pub quote: QuoteSpan,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub content: String,
    pub filename: String,
}

pub type FileInput = Document;
#[allow(non_camel_case_types)]
pub type quote_string_t = String;
#[allow(non_camel_case_types)]
pub type quote_span_t = QuoteSpan;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextQuoteLoose {
    pub text: String,
    pub quote: String,
}

#[allow(non_camel_case_types)]
pub type text_quote_t = TextQuoteLoose;

/// New claim work description — fills {description} in the first example-select pass.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkDescription {
    /// Plain-language damage description
    pub description: String,
}

/// Reference to a catalog work item on a past job.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BilledLineRef {
    /// Catalog work item id
    pub work_item_id: String,
    /// Billed quantity
    pub quantity: f64,
    /// Optional unit clarification
    pub unit_note: Option<String>,
}

/// One past repair job from the example library.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobExample {
    /// Stable job example id
    pub id: String,
    /// Short label
    pub title: String,
    /// Past claim narrative
    pub work_description: String,
    /// Structured billed work references
    pub billed_items: Vec<BilledLineRef>,
}

/// Relevant past job after example-select — includes selection_reason.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectedJobExample {
    /// Matches library id
    pub id: String,
    /// Short label
    pub title: String,
    /// Past claim narrative
    pub work_description: String,
    /// Structured billed work references
    pub billed_items: Vec<BilledLineRef>,
    /// Why this job is useful for the current claim
    pub selection_reason: String,
}

/// Parsed JSON upload — examples array for job library input.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobExampleLibraryFile {
    /// Past job rows
    pub examples: Vec<JobExample>,
}

/// Work description + job example library merged by combine.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobSelectBundle {
    /// WorkDescription from Normalize Case
    pub case: WorkDescription,
    /// Job example library side input
    pub library: JobExampleLibraryFile,
}

/// Claim description + selected past jobs — cached context for catalog filtering.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemFilterContext {
    /// Current claim work description
    pub description: String,
    /// Filtered past jobs
    pub selected_examples: Vec<SelectedJobExample>,
}

/// One row from the master work-item catalog.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkItem {
    /// Catalog id
    pub id: String,
    /// Trade code
    pub code: String,
    /// Trade category
    pub trade: String,
    /// Billing unit
    pub unit: String,
    /// Line item description
    pub description: String,
}

/// Parsed JSON upload — items array for catalog input.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkItemCatalogFile {
    /// Master catalog rows
    pub items: Vec<WorkItem>,
}

/// Item filter context + work item catalog merged by combine.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogSelectBundle {
    /// Description + selected jobs from Merge for Item Filter
    pub draft_context: ItemFilterContext,
    /// Work item catalog side input
    pub catalog: WorkItemCatalogFile,
}

/// Relevant catalog row after example-select — includes selection_reason.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectedWorkItem {
    /// Catalog id
    pub id: String,
    /// Trade code
    pub code: String,
    /// Trade category
    pub trade: String,
    /// Billing unit
    pub unit: String,
    /// Line item description
    pub description: String,
    /// Why this catalog item applies to the claim
    pub selection_reason: String,
}

/// Merged description, jobs, and filtered catalog items for final LLM.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BilledWorkDraftRequest {
    /// Current claim
    pub description: String,
    /// Filtered past jobs
    pub selected_examples: Vec<SelectedJobExample>,
    /// Filtered catalog rows
    pub selected_work_items: Vec<SelectedWorkItem>,
}

/// One billed line on the draft scope.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DraftLineItem {
    /// Catalog id
    pub work_item_id: String,
    /// Proposed quantity
    pub quantity: f64,
    /// Why this line is on the scope
    pub rationale: String,
}

/// Draft structured billed work for the new claim.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BilledWorkDraft {
    /// Short job title
    pub title: String,
    /// Proposed billed lines
    pub line_items: Vec<DraftLineItem>,
}

/// Auto-derived merge spine operand.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WrapSelectedExamples {
    /// Filtered past jobs
    pub selected_examples: Vec<SelectedJobExample>,
}

/// Auto-derived merge spine operand.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WrapSelectedWorkItems {
    /// Filtered catalog rows
    pub selected_work_items: Vec<SelectedWorkItem>,
}


// === pipeline state ===
// Pipeline state — step label → spine snapshot (JSON for open typing).
    // "Work Description": Document
    // "Normalize Case": WorkDescription
    // "Job Example Library": JobExampleLibraryFile
    // "Combine Job Inputs": JobSelectBundle
    // "Parse Job Examples": Vec<JobExample>
    // "Select Relevant Jobs": Vec<SelectedJobExample>
    // "Merge for Item Filter": ItemFilterContext
    // "Work Item Catalog": WorkItemCatalogFile
    // "Combine Catalog": CatalogSelectBundle
    // "Parse Work Items": Vec<WorkItem>
    // "Select Relevant Work Items": Vec<SelectedWorkItem>
    // "Merge for Draft": BilledWorkDraftRequest
    // "Draft Billed Work": BilledWorkDraft
    // "Billed Work Output": BilledWorkDraft
pub type PipelineState = HashMap<String, Value>;

// === runtime config (load .env in your runner — pass values here, not in this file) ===
#[derive(Debug, Clone, Default)]
pub struct PipelineRuntime {
    pub llm_provider_id: Option<String>,
    pub llm_provider_model: Option<String>,
    pub open_router_api_key: Option<String>,
    pub open_router_model: Option<String>,
    pub open_router_site_url: Option<String>,
    pub open_router_app_title: Option<String>,
    pub vision_ocr_model: Option<String>,
    // AI : TODO export — Supabase persistence / step cache.
}

static RUNTIME: std::sync::OnceLock<std::sync::Mutex<PipelineRuntime>> = std::sync::OnceLock::new();

fn runtime() -> std::sync::MutexGuard<'static, PipelineRuntime> {
    RUNTIME
        .get_or_init(|| std::sync::Mutex::new(PipelineRuntime::default()))
        .lock()
        .expect("pipeline runtime lock")
}

pub fn configure_pipeline_runtime(config: PipelineRuntime) {
    *runtime() = config;
}

// --- runtime stubs (replace bodies or inject via configure_pipeline_runtime) ---

const OPENROUTER_CHAT_URL: &str = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_MODEL: &str = "deepseek/deepseek-chat";

fn extract_json_reply(raw: &str) -> String {
    let body = if let Some(start) = raw.find("```") {
        let after = &raw[start + 3..];
        let after = after.strip_prefix("json").unwrap_or(after).trim_start();
        after.split("```").next().unwrap_or(after).trim()
    } else {
        raw.trim()
    };
    let start = body.find(['{', '[']).unwrap_or(0);
    let end = body.rfind(['}', ']']).map(|i| i + 1).unwrap_or(body.len());
    if end > start { body[start..end].to_string() } else { body.to_string() }
}

async fn open_router_chat(prompt: &str, json_mode: bool) -> anyhow::Result<String> {
    let rt = runtime();
    let key = rt.open_router_api_key.clone().ok_or_else(|| anyhow::anyhow!("configure_pipeline_runtime first"))?;
    let model = rt.open_router_model.clone().unwrap_or_else(|| DEFAULT_OPENROUTER_MODEL.to_string());
    let site = rt.open_router_site_url.clone().unwrap_or_else(|| "http://localhost:3000".to_string());
    let title = rt.open_router_app_title.clone().unwrap_or_else(|| "forge-pipeline-export".to_string());
    drop(rt);
    let mut payload = serde_json::json!({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
        "max_tokens": 8192,
        "provider": {"allow_fallbacks": false},
    });
    if json_mode {
        payload["response_format"] = serde_json::json!({"type": "json_object"});
    }
    let client = reqwest::Client::new();
    let res = client
        .post(OPENROUTER_CHAT_URL)
        .header("Authorization", format!("Bearer {}", key))
        .header("HTTP-Referer", site)
        .header("X-Title", title)
        .json(&payload)
        .send()
        .await?;
    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        anyhow::bail!("OpenRouter {}: {}", status, text);
    }
    let data: Value = res.json().await?;
    let content = data
        .pointer("/choices/0/message/content")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("OpenRouter returned no message content"))?;
    Ok(content.to_string())
}

async fn llm_structured(prompt: &str, schema: &Value) -> anyhow::Result<Value> {
    if runtime().open_router_api_key.is_none() {
        anyhow::bail!("configure_pipeline_runtime(open_router_api_key=...) first");
    }
    let schema_json = serde_json::to_string_pretty(schema)?;
    let base = format!(
        "{}\n\nRespond with ONLY a JSON value that validates against this JSON Schema:\n{}",
        prompt, schema_json
    );
    let mut last_error = String::new();
    for attempt in 0..2 {
        let ask = if attempt == 0 {
            base.clone()
        } else {
            format!("{}\n\nYour previous reply failed validation:\n{}\nReturn corrected JSON only.", base, last_error)
        };
        let raw = open_router_chat(&ask, true).await?;
        let json_text = extract_json_reply(&raw);
        match serde_json::from_str::<Value>(&json_text) {
            Ok(v) => return Ok(v),
            Err(e) => {
                last_error = e.to_string();
                if attempt == 1 {
                    anyhow::bail!("structured response parse failed after retry: {}", last_error);
                }
            }
        }
    }
    anyhow::bail!("structured response failed")
}

// === steps ===
/// Work Description
/// Kind: Input
/// New claim narrative — feeds {description} via Normalize Case
/// Cached: true
async fn step_work_description(input: Document, _state: &mut PipelineState) -> anyhow::Result<Document> {
    // Parse uploaded file — built-in parser or vision OCR when enabled
    // Input guard: "Plain-text description of the new repair claim"
    // Filename must contain: "work_description"
    Ok(input)
}

/// Normalize Case
/// Kind: Custom Code
/// Document → WorkDescription — deterministic wrapper for example-select context.
/// Cached: true
async fn step_normalize_case(input: Document, _state: &mut PipelineState) -> anyhow::Result<WorkDescription> {
    // TypeScript custom code (1 attempt) (not inlined — port or call via FFI):
    // (doc) => ({ description: String(doc?.content ?? "").trim() })
    let out: WorkDescription = serde_json::from_value(serde_json::to_value(&input)?)?;
    Ok(out)
}

/// Job Example Library
/// Kind: Input
/// Past jobs with billed_items references — side input before combine
/// Cached: true
async fn step_job_example_library(input: Document, _state: &mut PipelineState) -> anyhow::Result<JobExampleLibraryFile> {
    // Parse uploaded file — built-in parser or vision OCR when enabled
    // Input guard: "JSON file with examples array of structured past jobs"
    // Filename must contain: "job_example_library"
    let parsed: Value = serde_json::from_str(&input.content)?;
    let out: JobExampleLibraryFile = serde_json::from_value(parsed)?;
    Ok(out)
}

/// Combine Job Inputs
/// Kind: Combine Inputs
/// Merges WorkDescription with Job Example Library side input.
/// Cached: true
async fn step_combine_job_inputs(input: JobExampleLibraryFile, state: &mut PipelineState) -> anyhow::Result<JobSelectBundle> {
    // Merge uploaded document with upstream WorkDescription from pipeline state
    let new_doc = input;
    let merged = JobSelectBundle {
            case: serde_json::from_value(state.get("Normalize Case").cloned().unwrap_or(Value::Null))?,
            library: serde_json::from_value(serde_json::to_value(&new_doc)?)?,
    };
    Ok(merged)
}

/// Parse Job Examples
/// Kind: Custom Code
/// JobSelectBundle → list[JobExample].
/// Cached: true
async fn step_parse_job_examples(input: JobSelectBundle, _state: &mut PipelineState) -> anyhow::Result<Vec<JobExample>> {
    // TypeScript custom code (1 attempt) (not inlined — port or call via FFI):
    // (bundle) => { const rows = bundle?.library?.examples; if (!Array.isArray(rows)) throw new Error("expected examples array"); return rows; }
    let out: Vec<JobExample> = serde_json::from_value(serde_json::to_value(&input)?)?;
    Ok(out)
}

/// Select Relevant Jobs
/// Kind: Example Select
/// Pass 1 — filter past jobs by similarity to the claim description.
/// Model: openrouter:deepseek-v4
/// Cached: true
async fn step_select_relevant_jobs(input: Vec<JobExample>, _state: &mut PipelineState) -> anyhow::Result<Vec<SelectedJobExample>> {
    Ok(input)
}

/// Merge for Item Filter
/// Kind: Merge
/// Deep-merge Normalize Case with selected_examples → ItemFilterContext (cached prefix for pass 2).
/// Cached: true
async fn step_merge_for_item_filter(input: Vec<SelectedJobExample>, _state: &mut PipelineState) -> anyhow::Result<ItemFilterContext> {
    // TypeScript custom code (1 attempt) (not inlined — port or call via FFI):
    // function __itemKeyFn(keyPath) {
    //   const parts = String(keyPath).split(".").filter(Boolean);
    //   return (item) => {
    //     let cur = item;
    //     for (const part of parts) {
    //       if (!cur || typeof cur !== "object" || !(part in cur)) throw new TypeError("itemKey \"" + keyPath + "\" missing");
    //       cur = cur[part];
    //     }
    //     if (cur == null) throw new TypeError("itemKey \"" + keyPath + "\" missing");
    //     return cur;
    //   };
    // }
    // function __cmpKey(item, keyFn) {
    //   if (keyFn) return keyFn(item);
    //   if (item == null || typeof item === "string" || typeof item === "number" || typeof item === "boolean") return item;
    //   return JSON.stringify(item);
    // }
    // function __pathForItem(path, ck, index) {
    //   if (typeof ck === "string" || typeof ck === "number") return [...path, ck];
    //   return [...path, index];
    // }
    // function __zipMerge(left, right, resolver, path) {
    //   const n = Math.max(left.length, right.length), out = [];
    //   for (let i = 0; i < n; i++) {
    //     const child = [...path, i];
    //     if (i < left.length && i < right.length) out.push(__mergePair(left[i], right[i], resolver, child));
    //     else out.push(i < left.length ? left[i] : right[i]);
    //   }
    //   return out;
    // }
    // function __dedupeMerge(items, keyFn, resolver, path) {
    //   const seen = new Map(), out = [];
    //   for (const item of items) {
    //     const k = __cmpKey(item, keyFn);
    //     if (seen.has(k)) {
    //       const idx = seen.get(k);
    //       out[idx] = __mergePair(out[idx], item, resolver, __pathForItem(path, k, idx));
    //       continue;
    //     }
    //     seen.set(k, out.length);
    //     out.push(item);
    //   }
    //   return out;
    // }
    // function __assertNoDupes(items, keyFn, path) {
    //   const seen = new Set(), out = [];
    //   const label = path.length ? path.join(".") : "<root>";
    //   for (const item of items) {
    //     const k = __cmpKey(item, keyFn);
    //     if (seen.has(k)) throw new TypeError("duplicate list item at path " + label + " (key=" + String(k) + ")");
    //     seen.add(k);
    //     out.push(item);
    //   }
    //   return out;
    // }
    // function __setOp(left, right, keyFn, resolver, path, op) {
    //   const lk = left.map((i) => __cmpKey(i, keyFn)), rk = right.map((i) => __cmpKey(i, keyFn));
    //   const ls = new Set(lk), rs = new Set(rk);
    //   const wanted = op === "union" ? new Set([...ls, ...rs]) : new Set([...lk].filter((k) => rs.has(k)));
    //   const order = [];
    //   const seen = new Set();
    //   for (const k of [...lk, ...rk]) {
    //     if (wanted.has(k) && !seen.has(k)) { seen.add(k); order.push(k); }
    //   }
    //   const map = new Map(), idx = new Map();
    //   left.forEach((item, i) => {
    //     const k = lk[i];
    //     if (!map.has(k)) { map.set(k, item); idx.set(k, i); }
    //     else map.set(k, __mergePair(map.get(k), item, resolver, __pathForItem(path, k, idx.get(k))));
    //   });
    //   right.forEach((item, i) => {
    //     const k = rk[i];
    //     if (!map.has(k)) { map.set(k, item); idx.set(k, left.length + i); }
    //     else map.set(k, __mergePair(map.get(k), item, resolver, __pathForItem(path, k, idx.get(k))));
    //   });
    //   return order.map((k) => map.get(k));
    // }
    // function __assertUnionNoOverlap(left, right, keyFn, path) {
    //   const lk = left.map((i) => __cmpKey(i, keyFn));
    //   const ls = new Set(lk);
    //   const label = path.length ? path.join(".") : "<root>";
    //   for (const item of right) {
    //     const k = __cmpKey(item, keyFn);
    //     if (ls.has(k)) throw new TypeError("union key overlap at path " + label + " (key=" + String(k) + ")");
    //   }
    //   return [...left, ...right];
    // }
    // function __assertIntersectSubset(left, right, keyFn, path) {
    //   const rs = new Set(right.map((i) => __cmpKey(i, keyFn)));
    //   const label = path.length ? path.join(".") : "<root>";
    //   for (const item of left) {
    //     const k = __cmpKey(item, keyFn);
    //     if (!rs.has(k)) throw new TypeError("intersect: left item not in right at path " + label + " (key=" + String(k) + ")");
    //   }
    //   return left;
    // }
    // function __assertReplaceEmptyLeft(left, right, path) {
    //   const label = path.length ? path.join(".") : "<root>";
    //   if (left.length) throw new TypeError("replace assert: left list must be empty at path " + label + " (got " + left.length + " items)");
    //   return [...right];
    // }
    // function __assertPrependEmptyRight(left, right, path) {
    //   const label = path.length ? path.join(".") : "<root>";
    //   if (right.length) throw new TypeError("prepend assert: right list must be empty at path " + label + " (got " + right.length + " items)");
    //   return [...left];
    // }
    // function __suffixMatch(pattern, path) {
    //   if (pattern.length !== path.length) return false;
    //   for (let i = 0; i < pattern.length; i++) {
    //     if (pattern[i] !== "*" && String(pattern[i]) !== String(path[i])) return false;
    //   }
    //   return true;
    // }
    // function __globstarFrom(pattern, path, pi, si) {
    //   if (pi === pattern.length) return si === path.length ? path.length : null;
    //   if (pattern[pi] === "**") {
    //     let best = null;
    //     for (let span = si; span <= path.length; span++) {
    //       const d = __globstarFrom(pattern, path, pi + 1, span);
    //       if (d != null && (best == null || d > best)) best = d;
    //     }
    //     return best;
    //   }
    //   if (si >= path.length) return null;
    //   if (pattern[pi] !== "*" && String(pattern[pi]) !== String(path[si])) return null;
    //   return __globstarFrom(pattern, path, pi + 1, si + 1);
    // }
    // function __patternDepth(pattern, path) {
    //   const parts = pattern.split(".").filter(Boolean);
    //   if (!parts.length) return path.length ? null : 0;
    //   if (parts.includes("**")) return __globstarFrom(parts, path, 0, 0);
    //   if (parts.length > path.length) return null;
    //   const offset = path.length - parts.length;
    //   return __suffixMatch(parts, path.slice(offset)) ? parts.length : null;
    // }
    // const __mergePair = function(left, right, resolver, path) {
    //   if (left == null) return right;
    //   if (right == null) return left;
    //   const layer = resolver.resolve(path);
    //   const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
    //   const isScalar = (v) => v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
    //   if (isObj(left) && isObj(right)) {
    //     if (layer.dict === "replace") return { ...right };
    //     if (layer.dict === "shallow") return { ...left, ...right };
    //     const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    //     const out = {};
    //     for (const key of keys) {
    //       const child = [...path, key];
    //       if (key in left && key in right) out[key] = __mergePair(left[key], right[key], resolver, child);
    //       else out[key] = key in left ? left[key] : right[key];
    //     }
    //     return out;
    //   }
    //   if (Array.isArray(left) && Array.isArray(right)) {
    //     const s = layer.list;
    //     if (s === "replace") return [...right];
    //     if (s === "prepend") return [...right, ...left];
    //     if (s === "concat") return [...left, ...right];
    //     if (s === "zip") return __zipMerge(left, right, resolver, path);
    //     if (s === "concat_dedupe") return __dedupeMerge([...left, ...right], layer.keyFn, resolver, path);
    //     if (s === "concat_assert_no_duplicates") return __assertNoDupes([...left, ...right], layer.keyFn, path);
    //     if (s === "union") return __setOp(left, right, layer.keyFn, resolver, path, "union");
    //     if (s === "union_assert") return __assertUnionNoOverlap(left, right, layer.keyFn, path);
    //     if (s === "intersect") return __setOp(left, right, layer.keyFn, resolver, path, "intersect");
    //     if (s === "intersect_assert") return __assertIntersectSubset(left, right, layer.keyFn, path);
    //     if (s === "replace_assert") return __assertReplaceEmptyLeft(left, right, path);
    //     if (s === "prepend_assert") return __assertPrependEmptyRight(left, right, path);
    //     throw new Error("unknown list strategy: " + s);
    //   }
    //   if (isScalar(left) && isScalar(right)) {
    //     if (layer.scalar === "first") return left;
    //     if (layer.scalar === "last") return right;
    //     throw new TypeError("scalar conflict");
    //   }
    //   if (typeof left === typeof right) return layer.scalar === "first" ? left : right;
    //   throw new TypeError("cannot merge " + typeof left + " with " + typeof right);
    // };
    // const __resolve = class {
    //   constructor(policy) {
    //     const def = policy?.default ?? {};
    //     this.default = {
    //       list: def.list ?? "concat",
    //       dict: def.dict ?? "deep",
    //       scalar: def.scalar ?? "last",
    //       keyFn: def.itemKey ? __itemKeyFn(def.itemKey) : undefined,
    //     };
    //     this.rules = (policy?.rules ?? []).map((r) => ({
    //       pattern: r.path,
    //       policy: {
    //         list: r.policy?.list ?? this.default.list,
    //         dict: r.policy?.dict ?? this.default.dict,
    //         scalar: r.policy?.scalar ?? this.default.scalar,
    //         keyFn: r.policy?.itemKey ? __itemKeyFn(r.policy.itemKey) : undefined,
    //       },
    //     }));
    //   }
    //   resolve(path) {
    //     let matched, depth = -1;
    //     for (const { pattern, policy } of this.rules) {
    //       const d = __patternDepth(pattern, path);
    //       if (d != null && d > depth) { matched = policy; depth = d; }
    //     }
    //     return matched ?? this.default;
    //   }
    // };
    // (input, state) => {
    //   let spine = input;
    //   if ("selected_examples" && Array.isArray(spine)) spine = { ["selected_examples"]: spine };
    //   const values = [];
    //   if ("Normalize Case") {
    //     const fromState = (state ?? {})["Normalize Case"];
    //     if (fromState != null) values.push(fromState);
    //   }
    //   if (spine != null) values.push(spine);
    //   const resolver = new __resolve({"default":{"list":"concat","dict":"deep","scalar":"last"}});
    //   if (!values.length) return null;
    //   if (values.length === 1) return values[0];
    //   let result = values[0];
    //   for (let i = 1; i < values.length; i++) result = __mergePair(result, values[i], resolver, []);
    //   return result;
    // }
    let out: ItemFilterContext = serde_json::from_value(serde_json::to_value(&input)?)?;
    Ok(out)
}

/// Work Item Catalog
/// Kind: Input
/// 100-item catalog for pass 2 — too large for one prompt; filtered per row with cached prefix
/// Cached: true
async fn step_work_item_catalog(input: Document, _state: &mut PipelineState) -> anyhow::Result<WorkItemCatalogFile> {
    // Parse uploaded file — built-in parser or vision OCR when enabled
    // Input guard: "JSON file with items array — master catalog of billable work items"
    // Filename must contain: "work_item_catalog"
    let parsed: Value = serde_json::from_str(&input.content)?;
    let out: WorkItemCatalogFile = serde_json::from_value(parsed)?;
    Ok(out)
}

/// Combine Catalog
/// Kind: Combine Inputs
/// Merges ItemFilterContext with Work Item Catalog side input.
/// Cached: true
async fn step_combine_catalog(input: WorkItemCatalogFile, state: &mut PipelineState) -> anyhow::Result<CatalogSelectBundle> {
    // Merge uploaded document with upstream ItemFilterContext from pipeline state
    let new_doc = input;
    let merged = CatalogSelectBundle {
            draft_context: serde_json::from_value(state.get("Merge for Item Filter").cloned().unwrap_or(Value::Null))?,
            catalog: serde_json::from_value(serde_json::to_value(&new_doc)?)?,
    };
    Ok(merged)
}

/// Parse Work Items
/// Kind: Custom Code
/// CatalogSelectBundle → list[WorkItem].
/// Cached: true
async fn step_parse_work_items(input: CatalogSelectBundle, _state: &mut PipelineState) -> anyhow::Result<Vec<WorkItem>> {
    // TypeScript custom code (1 attempt) (not inlined — port or call via FFI):
    // (bundle) => { const rows = bundle?.catalog?.items; if (!Array.isArray(rows)) throw new Error("expected items array"); return rows; }
    let out: Vec<WorkItem> = serde_json::from_value(serde_json::to_value(&input)?)?;
    Ok(out)
}

/// Select Relevant Work Items
/// Kind: Example Select
/// Pass 2 — filter catalog rows; context is full ItemFilterContext JSON (description + selected jobs).
/// Model: openrouter:deepseek-v4
/// Cached: true
async fn step_select_relevant_work_items(input: Vec<WorkItem>, _state: &mut PipelineState) -> anyhow::Result<Vec<SelectedWorkItem>> {
    Ok(input)
}

/// Merge for Draft
/// Kind: Merge
/// Deep-merge ItemFilterContext with selected_work_items → BilledWorkDraftRequest.
/// Cached: true
async fn step_merge_for_draft(input: Vec<SelectedWorkItem>, _state: &mut PipelineState) -> anyhow::Result<BilledWorkDraftRequest> {
    // TypeScript custom code (1 attempt) (not inlined — port or call via FFI):
    // function __itemKeyFn(keyPath) {
    //   const parts = String(keyPath).split(".").filter(Boolean);
    //   return (item) => {
    //     let cur = item;
    //     for (const part of parts) {
    //       if (!cur || typeof cur !== "object" || !(part in cur)) throw new TypeError("itemKey \"" + keyPath + "\" missing");
    //       cur = cur[part];
    //     }
    //     if (cur == null) throw new TypeError("itemKey \"" + keyPath + "\" missing");
    //     return cur;
    //   };
    // }
    // function __cmpKey(item, keyFn) {
    //   if (keyFn) return keyFn(item);
    //   if (item == null || typeof item === "string" || typeof item === "number" || typeof item === "boolean") return item;
    //   return JSON.stringify(item);
    // }
    // function __pathForItem(path, ck, index) {
    //   if (typeof ck === "string" || typeof ck === "number") return [...path, ck];
    //   return [...path, index];
    // }
    // function __zipMerge(left, right, resolver, path) {
    //   const n = Math.max(left.length, right.length), out = [];
    //   for (let i = 0; i < n; i++) {
    //     const child = [...path, i];
    //     if (i < left.length && i < right.length) out.push(__mergePair(left[i], right[i], resolver, child));
    //     else out.push(i < left.length ? left[i] : right[i]);
    //   }
    //   return out;
    // }
    // function __dedupeMerge(items, keyFn, resolver, path) {
    //   const seen = new Map(), out = [];
    //   for (const item of items) {
    //     const k = __cmpKey(item, keyFn);
    //     if (seen.has(k)) {
    //       const idx = seen.get(k);
    //       out[idx] = __mergePair(out[idx], item, resolver, __pathForItem(path, k, idx));
    //       continue;
    //     }
    //     seen.set(k, out.length);
    //     out.push(item);
    //   }
    //   return out;
    // }
    // function __assertNoDupes(items, keyFn, path) {
    //   const seen = new Set(), out = [];
    //   const label = path.length ? path.join(".") : "<root>";
    //   for (const item of items) {
    //     const k = __cmpKey(item, keyFn);
    //     if (seen.has(k)) throw new TypeError("duplicate list item at path " + label + " (key=" + String(k) + ")");
    //     seen.add(k);
    //     out.push(item);
    //   }
    //   return out;
    // }
    // function __setOp(left, right, keyFn, resolver, path, op) {
    //   const lk = left.map((i) => __cmpKey(i, keyFn)), rk = right.map((i) => __cmpKey(i, keyFn));
    //   const ls = new Set(lk), rs = new Set(rk);
    //   const wanted = op === "union" ? new Set([...ls, ...rs]) : new Set([...lk].filter((k) => rs.has(k)));
    //   const order = [];
    //   const seen = new Set();
    //   for (const k of [...lk, ...rk]) {
    //     if (wanted.has(k) && !seen.has(k)) { seen.add(k); order.push(k); }
    //   }
    //   const map = new Map(), idx = new Map();
    //   left.forEach((item, i) => {
    //     const k = lk[i];
    //     if (!map.has(k)) { map.set(k, item); idx.set(k, i); }
    //     else map.set(k, __mergePair(map.get(k), item, resolver, __pathForItem(path, k, idx.get(k))));
    //   });
    //   right.forEach((item, i) => {
    //     const k = rk[i];
    //     if (!map.has(k)) { map.set(k, item); idx.set(k, left.length + i); }
    //     else map.set(k, __mergePair(map.get(k), item, resolver, __pathForItem(path, k, idx.get(k))));
    //   });
    //   return order.map((k) => map.get(k));
    // }
    // function __assertUnionNoOverlap(left, right, keyFn, path) {
    //   const lk = left.map((i) => __cmpKey(i, keyFn));
    //   const ls = new Set(lk);
    //   const label = path.length ? path.join(".") : "<root>";
    //   for (const item of right) {
    //     const k = __cmpKey(item, keyFn);
    //     if (ls.has(k)) throw new TypeError("union key overlap at path " + label + " (key=" + String(k) + ")");
    //   }
    //   return [...left, ...right];
    // }
    // function __assertIntersectSubset(left, right, keyFn, path) {
    //   const rs = new Set(right.map((i) => __cmpKey(i, keyFn)));
    //   const label = path.length ? path.join(".") : "<root>";
    //   for (const item of left) {
    //     const k = __cmpKey(item, keyFn);
    //     if (!rs.has(k)) throw new TypeError("intersect: left item not in right at path " + label + " (key=" + String(k) + ")");
    //   }
    //   return left;
    // }
    // function __assertReplaceEmptyLeft(left, right, path) {
    //   const label = path.length ? path.join(".") : "<root>";
    //   if (left.length) throw new TypeError("replace assert: left list must be empty at path " + label + " (got " + left.length + " items)");
    //   return [...right];
    // }
    // function __assertPrependEmptyRight(left, right, path) {
    //   const label = path.length ? path.join(".") : "<root>";
    //   if (right.length) throw new TypeError("prepend assert: right list must be empty at path " + label + " (got " + right.length + " items)");
    //   return [...left];
    // }
    // function __suffixMatch(pattern, path) {
    //   if (pattern.length !== path.length) return false;
    //   for (let i = 0; i < pattern.length; i++) {
    //     if (pattern[i] !== "*" && String(pattern[i]) !== String(path[i])) return false;
    //   }
    //   return true;
    // }
    // function __globstarFrom(pattern, path, pi, si) {
    //   if (pi === pattern.length) return si === path.length ? path.length : null;
    //   if (pattern[pi] === "**") {
    //     let best = null;
    //     for (let span = si; span <= path.length; span++) {
    //       const d = __globstarFrom(pattern, path, pi + 1, span);
    //       if (d != null && (best == null || d > best)) best = d;
    //     }
    //     return best;
    //   }
    //   if (si >= path.length) return null;
    //   if (pattern[pi] !== "*" && String(pattern[pi]) !== String(path[si])) return null;
    //   return __globstarFrom(pattern, path, pi + 1, si + 1);
    // }
    // function __patternDepth(pattern, path) {
    //   const parts = pattern.split(".").filter(Boolean);
    //   if (!parts.length) return path.length ? null : 0;
    //   if (parts.includes("**")) return __globstarFrom(parts, path, 0, 0);
    //   if (parts.length > path.length) return null;
    //   const offset = path.length - parts.length;
    //   return __suffixMatch(parts, path.slice(offset)) ? parts.length : null;
    // }
    // const __mergePair = function(left, right, resolver, path) {
    //   if (left == null) return right;
    //   if (right == null) return left;
    //   const layer = resolver.resolve(path);
    //   const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
    //   const isScalar = (v) => v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
    //   if (isObj(left) && isObj(right)) {
    //     if (layer.dict === "replace") return { ...right };
    //     if (layer.dict === "shallow") return { ...left, ...right };
    //     const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    //     const out = {};
    //     for (const key of keys) {
    //       const child = [...path, key];
    //       if (key in left && key in right) out[key] = __mergePair(left[key], right[key], resolver, child);
    //       else out[key] = key in left ? left[key] : right[key];
    //     }
    //     return out;
    //   }
    //   if (Array.isArray(left) && Array.isArray(right)) {
    //     const s = layer.list;
    //     if (s === "replace") return [...right];
    //     if (s === "prepend") return [...right, ...left];
    //     if (s === "concat") return [...left, ...right];
    //     if (s === "zip") return __zipMerge(left, right, resolver, path);
    //     if (s === "concat_dedupe") return __dedupeMerge([...left, ...right], layer.keyFn, resolver, path);
    //     if (s === "concat_assert_no_duplicates") return __assertNoDupes([...left, ...right], layer.keyFn, path);
    //     if (s === "union") return __setOp(left, right, layer.keyFn, resolver, path, "union");
    //     if (s === "union_assert") return __assertUnionNoOverlap(left, right, layer.keyFn, path);
    //     if (s === "intersect") return __setOp(left, right, layer.keyFn, resolver, path, "intersect");
    //     if (s === "intersect_assert") return __assertIntersectSubset(left, right, layer.keyFn, path);
    //     if (s === "replace_assert") return __assertReplaceEmptyLeft(left, right, path);
    //     if (s === "prepend_assert") return __assertPrependEmptyRight(left, right, path);
    //     throw new Error("unknown list strategy: " + s);
    //   }
    //   if (isScalar(left) && isScalar(right)) {
    //     if (layer.scalar === "first") return left;
    //     if (layer.scalar === "last") return right;
    //     throw new TypeError("scalar conflict");
    //   }
    //   if (typeof left === typeof right) return layer.scalar === "first" ? left : right;
    //   throw new TypeError("cannot merge " + typeof left + " with " + typeof right);
    // };
    // const __resolve = class {
    //   constructor(policy) {
    //     const def = policy?.default ?? {};
    //     this.default = {
    //       list: def.list ?? "concat",
    //       dict: def.dict ?? "deep",
    //       scalar: def.scalar ?? "last",
    //       keyFn: def.itemKey ? __itemKeyFn(def.itemKey) : undefined,
    //     };
    //     this.rules = (policy?.rules ?? []).map((r) => ({
    //       pattern: r.path,
    //       policy: {
    //         list: r.policy?.list ?? this.default.list,
    //         dict: r.policy?.dict ?? this.default.dict,
    //         scalar: r.policy?.scalar ?? this.default.scalar,
    //         keyFn: r.policy?.itemKey ? __itemKeyFn(r.policy.itemKey) : undefined,
    //       },
    //     }));
    //   }
    //   resolve(path) {
    //     let matched, depth = -1;
    //     for (const { pattern, policy } of this.rules) {
    //       const d = __patternDepth(pattern, path);
    //       if (d != null && d > depth) { matched = policy; depth = d; }
    //     }
    //     return matched ?? this.default;
    //   }
    // };
    // (input, state) => {
    //   let spine = input;
    //   if ("selected_work_items" && Array.isArray(spine)) spine = { ["selected_work_items"]: spine };
    //   const values = [];
    //   if ("Merge for Item Filter") {
    //     const fromState = (state ?? {})["Merge for Item Filter"];
    //     if (fromState != null) values.push(fromState);
    //   }
    //   if (spine != null) values.push(spine);
    //   const resolver = new __resolve({"default":{"list":"concat","dict":"deep","scalar":"last"}});
    //   if (!values.length) return null;
    //   if (values.length === 1) return values[0];
    //   let result = values[0];
    //   for (let i = 1; i < values.length; i++) result = __mergePair(result, values[i], resolver, []);
    //   return result;
    // }
    let out: BilledWorkDraftRequest = serde_json::from_value(serde_json::to_value(&input)?)?;
    Ok(out)
}

/// Draft Billed Work
/// Kind: LLM Call
/// Final structured scope using selected jobs, catalog items, and selection_reason fields.
/// Model: openrouter:deepseek-v4
/// Cached: true
async fn step_draft_billed_work(input: BilledWorkDraftRequest, _state: &mut PipelineState) -> anyhow::Result<BilledWorkDraft> {
    // Structured LLM call → BilledWorkDraft
    let _model = "openrouter:deepseek-v4";
    let _ = _model;
    let user_prompt = format!("{}\n\nINPUT DATA:\n{}", "Draft structured billed work for the claim. Use selected_examples for coverage patterns and selected_work_items as the allowed catalog pool — each row includes selection_reason. Pick quantities from past jobs where sensible. Output title and line_items with work_item_id, quantity, and rationale.", serde_json::to_string_pretty(&input)?);
    let schema = serde_json::json!({}); // JSON schema for BilledWorkDraft
    let value = llm_structured(&user_prompt, &schema).await?;
    let out: BilledWorkDraft = serde_json::from_value(value)?;
    Ok(out)
}

/// Billed Work Output
/// Kind: Output
/// Cached: true
async fn step_billed_work_output(input: BilledWorkDraft, _state: &mut PipelineState) -> anyhow::Result<BilledWorkDraft> {
    // Snapshot BilledWorkDraft
    Ok(input)
}

// === orchestrator ===
pub async fn run_pipeline(inputs: HashMap<String, Document>) -> anyhow::Result<Value> {
    let mut state: PipelineState = HashMap::new();
    let mut spine: Value;

    // 1. Work Description
    spine = serde_json::to_value(step_work_description(inputs.get("Work Description").cloned().ok_or_else(|| anyhow::anyhow!("missing input"))?, &mut state).await?)?;
    state.insert("Work Description".to_string(), spine.clone());

    // 2. Normalize Case
    spine = serde_json::to_value(step_normalize_case(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("Normalize Case".to_string(), spine.clone());

    // 3. Job Example Library
    spine = serde_json::to_value(step_job_example_library(inputs.get("Job Example Library").cloned().ok_or_else(|| anyhow::anyhow!("missing input"))?, &mut state).await?)?;
    state.insert("Job Example Library".to_string(), spine.clone());

    // 4. Combine Job Inputs
    spine = serde_json::to_value(step_combine_job_inputs(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("Combine Job Inputs".to_string(), spine.clone());

    // 5. Parse Job Examples
    spine = serde_json::to_value(step_parse_job_examples(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("Parse Job Examples".to_string(), spine.clone());

    // 6. Select Relevant Jobs
    spine = serde_json::to_value(step_select_relevant_jobs(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("Select Relevant Jobs".to_string(), spine.clone());

    // 7. Merge for Item Filter
    spine = serde_json::to_value(step_merge_for_item_filter(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("Merge for Item Filter".to_string(), spine.clone());

    // 8. Work Item Catalog
    spine = serde_json::to_value(step_work_item_catalog(inputs.get("Work Item Catalog").cloned().ok_or_else(|| anyhow::anyhow!("missing input"))?, &mut state).await?)?;
    state.insert("Work Item Catalog".to_string(), spine.clone());

    // 9. Combine Catalog
    spine = serde_json::to_value(step_combine_catalog(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("Combine Catalog".to_string(), spine.clone());

    // 10. Parse Work Items
    spine = serde_json::to_value(step_parse_work_items(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("Parse Work Items".to_string(), spine.clone());

    // 11. Select Relevant Work Items
    spine = serde_json::to_value(step_select_relevant_work_items(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("Select Relevant Work Items".to_string(), spine.clone());

    // 12. Merge for Draft
    spine = serde_json::to_value(step_merge_for_draft(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("Merge for Draft".to_string(), spine.clone());

    // 13. Draft Billed Work
    spine = serde_json::to_value(step_draft_billed_work(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("Draft Billed Work".to_string(), spine.clone());

    // 14. Billed Work Output
    spine = serde_json::to_value(step_billed_work_output(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("Billed Work Output".to_string(), spine.clone());

    Ok(spine)
}
