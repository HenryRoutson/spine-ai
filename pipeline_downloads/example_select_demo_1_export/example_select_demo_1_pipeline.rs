// Generated pipeline export — equivalent Rust representation
// Project: Example Select Demo
// 13 steps · 9 structures · 467 lines
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

/// New damage case text — fills {description} in the example-select prompt.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScopeDescription {
    /// Plain-language damage description
    pub description: String,
}

/// One reference scope-of-works row from the example library.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScopeExample {
    /// Stable example id
    pub id: String,
    /// Short label
    pub title: String,
    /// Past scope of works body
    pub scope_text: String,
}

/// Relevant example after example-select — includes selection_reason chain-of-thought.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectedExample {
    /// Matches library id
    pub id: String,
    /// Short label
    pub title: String,
    /// Past scope body
    pub scope_text: String,
    /// Why this example is useful for the current case
    pub selection_reason: String,
}

/// Merged description + filtered examples for the final LLM.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScopeDraftRequest {
    /// Current damage case
    pub description: String,
    /// LLM-filtered reference rows
    pub selected_examples: Vec<SelectedExample>,
}

/// Parsed JSON upload — examples array for the library input step.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExampleLibraryFile {
    /// Reference scope rows
    pub examples: Vec<ScopeExample>,
}

/// Damage case + example library merged by combine.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScopeSelectBundle {
    /// ScopeDescription from Normalize Case (pipeline state)
    pub case: ScopeDescription,
    /// Example library from the side input
    pub library: ExampleLibraryFile,
}

/// Draft scope of works for the new case.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScopeDraft {
    /// Short job title
    pub title: String,
    /// Numbered scope lines
    pub scope_of_works: String,
}


// === pipeline state ===
// Pipeline state — step label → spine snapshot (JSON for open typing).
    // "Damage Case": Document
    // "Normalize Case": ScopeDescription
    // "Example Library": ExampleLibraryFile
    // "Combine Inputs": ScopeSelectBundle
    // "Parse Examples": Vec<ScopeExample>
    // "Select Relevant Examples": Vec<SelectedExample>
    // "Merge for Draft": ScopeDraftRequest
    // "Draft Scope": ScopeDraft
    // "✓ Combine Inputs": ScopeSelectBundle
    // "✓ Normalize Case": ScopeDescription
    // "✓ Parse Examples": Vec<ScopeExample>
    // "✓ Select Relevant Examples": Vec<SelectedExample>
    // "Scope Output": ScopeDraft
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
/// Damage Case
/// Kind: Input
/// New leak description — feeds {description} via Normalize Case
/// Cached: true
async fn step_damage_case(input: Document, _state: &mut PipelineState) -> anyhow::Result<Document> {
    // Parse uploaded file — built-in parser or vision OCR when enabled
    // Input guard: "Plain-text description of the new damage case"
    // Filename must contain: "damage_case"
    Ok(input)
}

/// Normalize Case
/// Kind: Custom Code
/// Document → ScopeDescription — deterministic wrapper for the example-select context label.
/// Cached: true
async fn step_normalize_case(input: Document, _state: &mut PipelineState) -> anyhow::Result<ScopeDescription> {
    // TypeScript custom code (1 attempt) (not inlined — port or call via FFI):
    // (doc) => ({ description: String(doc?.content ?? "").trim() })
    let out: ScopeDescription = serde_json::from_value(serde_json::to_value(&input)?)?;
    Ok(out)
}

/// Example Library
/// Kind: Input
/// Reference example library — side input for combine (must follow Normalize Case on spine)
/// Cached: true
async fn step_example_library(input: Document, _state: &mut PipelineState) -> anyhow::Result<ExampleLibraryFile> {
    // Parse uploaded file — built-in parser or vision OCR when enabled
    // Input guard: "JSON file with examples array of past scope-of-works rows"
    // Filename must contain: "example_library"
    let parsed: Value = serde_json::from_str(&input.content)?;
    let out: ExampleLibraryFile = serde_json::from_value(parsed)?;
    Ok(out)
}

/// Combine Inputs
/// Kind: Combine Inputs
/// Merges ScopeDescription (pipeline state) with Example Library side input — required after input → code → input.
/// Cached: true
async fn step_combine_inputs(input: ExampleLibraryFile, state: &mut PipelineState) -> anyhow::Result<ScopeSelectBundle> {
    // Merge uploaded document with upstream ScopeDescription from pipeline state
    let new_doc = input;
    let merged = ScopeSelectBundle {
            case: serde_json::from_value(state.get("Normalize Case").cloned().unwrap_or(Value::Null))?,
            library: serde_json::from_value(serde_json::to_value(&new_doc)?)?,
    };
    Ok(merged)
}

/// Parse Examples
/// Kind: Custom Code
/// ScopeSelectBundle → list[ScopeExample] — examples from the merged library field.
/// Cached: true
async fn step_parse_examples(input: ScopeSelectBundle, _state: &mut PipelineState) -> anyhow::Result<Vec<ScopeExample>> {
    // TypeScript custom code (1 attempt) (not inlined — port or call via FFI):
    // (bundle) => { const rows = bundle?.library?.examples; if (!Array.isArray(rows)) throw new Error("expected examples array"); return rows; }
    let out: Vec<ScopeExample> = serde_json::from_value(serde_json::to_value(&input)?)?;
    Ok(out)
}

/// Select Relevant Examples
/// Kind: Example Select
/// LLM relevance filter — cached prefix + per-item is_relevant; not embedding RAG.
/// Model: deepseek-v4
/// Cached: true
async fn step_select_relevant_examples(input: Vec<ScopeExample>, _state: &mut PipelineState) -> anyhow::Result<Vec<SelectedExample>> {
    Ok(input)
}

/// Merge for Draft
/// Kind: Custom Code
/// list[SelectedExample] + description from Normalize Case on pipeline state → ScopeDraftRequest for the final LLM.
/// Cached: true
async fn step_merge_for_draft(input: SelectedExample, _state: &mut PipelineState) -> anyhow::Result<ScopeDraftRequest> {
    // TypeScript custom code (1 attempt) (not inlined — port or call via FFI):
    // (selected, state) => { const norm = (state ?? {})["Normalize Case"]; const description = norm && typeof norm === "object" && norm !== null && typeof norm.description === "string" ? norm.description : ""; return { description, selected_examples: Array.isArray(selected) ? selected : [] }; }
    let out: ScopeDraftRequest = serde_json::from_value(serde_json::to_value(&input)?)?;
    Ok(out)
}

/// Draft Scope
/// Kind: LLM Call
/// Final scope using selected examples and their selection_reason fields.
/// Model: deepseek-v4
/// Cached: true
async fn step_draft_scope(input: ScopeDraftRequest, _state: &mut PipelineState) -> anyhow::Result<ScopeDraft> {
    // Structured LLM call → ScopeDraft
    let _model = "deepseek-v4";
    let _ = _model;
    let user_prompt = format!("{}\n\nINPUT DATA:\n{}", "Write a numbered scope of works for the damage description. Use selected_examples only as style and coverage guidance — each row includes selection_reason explaining why it was chosen. Do not copy irrelevant work from distractor examples. Output a concise title and scope_of_works.", serde_json::to_string_pretty(&input)?);
    let schema = serde_json::json!({}); // JSON schema for ScopeDraft
    let value = llm_structured(&user_prompt, &schema).await?;
    let out: ScopeDraft = serde_json::from_value(value)?;
    Ok(out)
}

/// ✓ Combine Inputs
/// Kind: Assert
/// Structural check — combine retained case description and library examples
/// Cached: true
async fn step_8_combine_inputs(input: ScopeDraft, _state: &mut PipelineState) -> anyhow::Result<ScopeDraft> {
    // typescript assert (not inlined — port or call via FFI):
    // const b = step("Combine Inputs");
    // if (!b?.case?.description || typeof b.case.description !== "string" || !b.case.description.trim()) throw new Error("combine missing case.description");
    // if (!Array.isArray(b?.library?.examples) || b.library.examples.length < 1) throw new Error("combine missing library.examples");
    // Validate pipeline state — passthrough on success
    Ok(input)
}

/// ✓ Normalize Case
/// Kind: Assert
/// Golden fixture — damage text wrapped as ScopeDescription
/// Cached: true
async fn step_9_normalize_case(input: ScopeSelectBundle, _state: &mut PipelineState) -> anyhow::Result<ScopeSelectBundle> {
    // typescript assert (not inlined — port or call via FFI):
    // assertEqual(step("Normalize Case"), "Normalize Case");
    // Validate pipeline state — passthrough on success
    Ok(input)
}

/// ✓ Parse Examples
/// Kind: Assert
/// Golden fixture — four library rows parsed
/// Cached: true
async fn step_10_parse_examples(input: ScopeDescription, _state: &mut PipelineState) -> anyhow::Result<ScopeDescription> {
    // typescript assert (not inlined — port or call via FFI):
    // assertEqual(step("Parse Examples"), "Parse Examples");
    // Validate pipeline state — passthrough on success
    Ok(input)
}

/// ✓ Select Relevant Examples
/// Kind: Assert
/// Structural check — selected ids must exist in Example Library / Combine Inputs / Parse Examples
/// Cached: true
async fn step_11_select_relevant_examples(input: Vec<ScopeExample>, _state: &mut PipelineState) -> anyhow::Result<Vec<ScopeExample>> {
    // typescript assert (not inlined — port or call via FFI):
    // const selected = Array.isArray(input) ? input : step("Select Relevant Examples");
    // if (!Array.isArray(selected) || selected.length < 1) throw new Error("expected at least one selected example");
    // const rows = [
    //   step("Example Library")?.examples,
    //   step("Combine Inputs")?.library?.examples,
    //   step("Parse Examples"),
    // ].flatMap((v) => (Array.isArray(v) ? v : []));
    // if (!rows.length) throw new Error("expected library examples from Example Library, Combine Inputs, or Parse Examples");
    // const ids = new Set(rows.map((e) => e?.id).filter(Boolean));
    // for (const row of selected) {
    //   if (typeof row?.selection_reason !== "string" || !row.selection_reason.trim()) throw new Error("missing selection_reason");
    //   if (!ids.has(row?.id)) throw new Error(`unknown example id ${row?.id} (library has: ${[...ids].sort().join(", ")})`);
    // }
    // Validate pipeline state — passthrough on success
    Ok(input)
}

/// Scope Output
/// Kind: Output
/// Cached: true
async fn step_scope_output(input: Vec<SelectedExample>, _state: &mut PipelineState) -> anyhow::Result<Vec<SelectedExample>> {
    // Snapshot ScopeDraft
    Ok(input)
}

// === orchestrator ===
pub async fn run_pipeline(inputs: HashMap<String, Document>) -> anyhow::Result<Value> {
    let mut state: PipelineState = HashMap::new();
    let mut spine: Value;

    // 1. Damage Case
    spine = serde_json::to_value(step_damage_case(inputs.get("Damage Case").cloned().ok_or_else(|| anyhow::anyhow!("missing input"))?, &mut state).await?)?;
    state.insert("Damage Case".to_string(), spine.clone());

    // 2. Normalize Case
    spine = serde_json::to_value(step_normalize_case(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("Normalize Case".to_string(), spine.clone());

    // 3. Example Library
    spine = serde_json::to_value(step_example_library(inputs.get("Example Library").cloned().ok_or_else(|| anyhow::anyhow!("missing input"))?, &mut state).await?)?;
    state.insert("Example Library".to_string(), spine.clone());

    // 4. Combine Inputs
    spine = serde_json::to_value(step_combine_inputs(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("Combine Inputs".to_string(), spine.clone());

    // 5. Parse Examples
    spine = serde_json::to_value(step_parse_examples(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("Parse Examples".to_string(), spine.clone());

    // 6. Select Relevant Examples
    spine = serde_json::to_value(step_select_relevant_examples(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("Select Relevant Examples".to_string(), spine.clone());

    // 7. Merge for Draft
    spine = serde_json::to_value(step_merge_for_draft(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("Merge for Draft".to_string(), spine.clone());

    // 8. Draft Scope
    spine = serde_json::to_value(step_draft_scope(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("Draft Scope".to_string(), spine.clone());

    // 9. ✓ Combine Inputs
    spine = serde_json::to_value(step_8_combine_inputs(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("✓ Combine Inputs".to_string(), spine.clone());

    // 10. ✓ Normalize Case
    spine = serde_json::to_value(step_9_normalize_case(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("✓ Normalize Case".to_string(), spine.clone());

    // 11. ✓ Parse Examples
    spine = serde_json::to_value(step_10_parse_examples(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("✓ Parse Examples".to_string(), spine.clone());

    // 12. ✓ Select Relevant Examples
    spine = serde_json::to_value(step_11_select_relevant_examples(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("✓ Select Relevant Examples".to_string(), spine.clone());

    // 13. Scope Output
    spine = serde_json::to_value(step_scope_output(serde_json::from_value(spine)?, &mut state).await?)?;
    state.insert("Scope Output".to_string(), spine.clone());

    Ok(spine)
}
