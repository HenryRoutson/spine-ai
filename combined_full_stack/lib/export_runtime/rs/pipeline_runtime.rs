// AI : export runtime library — copied into pipeline zips as pipeline_runtime.rs (not generated).
use serde_json::Value;

// === runtime config (load .env in your runner — pass values here, not in this file) ===
#[derive(Debug, Clone, Default)]
pub struct PipelineRuntime {
    pub llm_provider_id: Option<String>,
    pub llm_provider_model: Option<String>,
    pub open_router_api_key: Option<String>,
    pub open_router_model: Option<String>,
    pub open_router_site_url: Option<String>,
    pub open_router_app_title: Option<String>,
    pub open_router_base_url: Option<String>,
    pub open_router_seed: Option<i64>,
    pub vision_ocr_model: Option<String>,
    pub source_text: Option<String>,
    pub source_doc_id: Option<String>,
    // Wire wait_for_human_review below — no callback field in this stub.
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

fn resolve_open_router_chat_url(base: &Option<String>) -> String {
    match base.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        None => OPENROUTER_CHAT_URL.to_string(),
        Some(b) if b.contains("/chat/completions") => b.to_string(),
        Some(b) => format!("{}/chat/completions", b.trim_end_matches('/')),
    }
}

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
    let url = resolve_open_router_chat_url(&rt.open_router_base_url);
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
        .post(&url)
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

pub async fn llm_structured(prompt: &str, schema: &Value) -> anyhow::Result<Value> {
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

// AI : shared example-select verdict — reused by every example-select step
pub fn relevance_schema() -> serde_json::Value {
    serde_json::json!({"chain_of_thought":"string","is_relevant":"boolean"})
}

pub fn example_select_items(input: &Value) -> Vec<Value> {
    if let Value::Array(arr) = input {
        return arr.clone();
    }
    if let Value::Object(map) = input {
        let arrays: Vec<&Vec<Value>> = map
            .values()
            .filter_map(|v| v.as_array())
            .collect();
        if arrays.len() == 1 {
            return arrays[0].clone();
        }
    }
    if input.is_null() {
        return Vec::new();
    }
    vec![input.clone()]
}

pub async fn select_relevant(
    items: Vec<Value>,
    description: &str,
    template: &str,
) -> anyhow::Result<Vec<Value>> {
    // AI : TODO (sql-schema) — add prompt_columns: &[String]. Project object keys before to_string_pretty.
    // AI :   Kept Value::Object still the original map + selection_reason. Replace {input_to_prompt} too.
    let schema = relevance_schema();
    let mut out = Vec::new();
    for item in items {
        let ask = template
            .replace("{description}", description)
            .replace("{example}", &serde_json::to_string_pretty(&item)?);
        let verdict = llm_structured(&ask, &schema).await?;
        if !verdict
            .get("is_relevant")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            continue;
        }
        let reason = verdict
            .get("chain_of_thought")
            .cloned()
            .unwrap_or(Value::String(String::new()));
        let row = match item {
            Value::Object(mut map) => {
                map.insert("selection_reason".to_string(), reason);
                Value::Object(map)
            }
            other => serde_json::json!({ "value": other, "selection_reason": reason }),
        };
        out.push(row);
    }
    Ok(out)
}

pub fn resolve_quotes(data: &impl serde::Serialize, source_text: &str, doc_id: &str) -> anyhow::Result<Value> {
    let rt = runtime();
    let text = rt.source_text.as_deref().unwrap_or(source_text);
    let did = rt.source_doc_id.as_deref().unwrap_or(doc_id);
    if text.is_empty() || did.is_empty() {
        anyhow::bail!("configure_pipeline_runtime(source_text=..., source_doc_id=...) for quote steps");
    }
    let _ = data;
    anyhow::bail!("wire resolve_quotes to your quote linker")
}

pub async fn wait_for_human_review<T: serde::Serialize>(_input: &T) -> anyhow::Result<()> {
    anyhow::bail!("wire wait_for_human_review")
}

pub async fn wait_for_chatbot_session<T: serde::Serialize>(_input: &T) -> anyhow::Result<serde_json::Value> {
    anyhow::bail!("wire wait_for_chatbot_session")
}

pub async fn call_webhook(_input: &serde_json::Value, _state: &serde_json::Value) -> anyhow::Result<serde_json::Value> {
    anyhow::bail!("wire call_webhook — set WEBHOOK_URL_* env vars and HTTP client")
}
pub fn merge_fold(values: Vec<Value>, policy: &Value) -> Value {
    if values.is_empty() {
        return Value::Null;
    }
    let mut result = values[0].clone();
    for nxt in values.into_iter().skip(1) {
        result = merge_pair(result, nxt, policy);
    }
    result
}

fn merge_pair(left: Value, right: Value, policy: &Value) -> Value {
    match (left, right) {
        (Value::Null, r) => r,
        (l, Value::Null) => l,
        (Value::Object(mut lm), Value::Object(rm)) => {
            for (k, v) in rm {
                let next = match lm.remove(&k) {
                    Some(prev) => merge_pair(prev, v, policy),
                    None => v,
                };
                lm.insert(k, next);
            }
            Value::Object(lm)
        }
        (Value::Array(mut ll), Value::Array(rl)) => {
            ll.extend(rl);
            Value::Array(ll)
        }
        (_, r) => r,
    }
}
