// Generated pipeline export — equivalent Go representation
// Project: Example Select Demo 2 1
// 14 steps · 18 structures · 1263 lines
// Setup: export also includes .env.example and README.md — copy .env.example → .env
// Stdlib: encoding/json, net/http (see README.md)

package pipeline

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
)

// === structures ===
type QuoteSpan struct {
	DocID string `json:"doc_id"`
	Start int64  `json:"start"`
	End   int64  `json:"end"`
}

type Quote = QuoteSpan

type TextQuote struct {
	Text  string    `json:"text"`
	Quote QuoteSpan `json:"quote"`
}

type Document struct {
	Content  string `json:"content"`
	Filename string `json:"filename"`
}

type FileInput = Document

type QuoteStringT = string
type QuoteSpanT = QuoteSpan

type TextQuoteLoose struct {
	Text  string `json:"text"`
	Quote string `json:"quote"`
}

type TextQuoteT = TextQuoteLoose

// New claim work description — fills {description} in the first example-select pass.
type WorkDescription struct {
	// Plain-language damage description
	Description string `json:"description"`
}

// Reference to a catalog work item on a past job.
type BilledLineRef struct {
	// Catalog work item id
	WorkItemId string `json:"work_item_id"`
	// Billed quantity
	Quantity float64 `json:"quantity"`
	// Optional unit clarification
	UnitNote *string `json:"unit_note,omitempty"`
}

// One past repair job from the example library.
type JobExample struct {
	// Stable job example id
	Id string `json:"id"`
	// Short label
	Title string `json:"title"`
	// Past claim narrative
	WorkDescription string `json:"work_description"`
	// Structured billed work references
	BilledItems []BilledLineRef `json:"billed_items"`
}

// Relevant past job after example-select — includes selection_reason.
type SelectedJobExample struct {
	// Matches library id
	Id string `json:"id"`
	// Short label
	Title string `json:"title"`
	// Past claim narrative
	WorkDescription string `json:"work_description"`
	// Structured billed work references
	BilledItems []BilledLineRef `json:"billed_items"`
	// Why this job is useful for the current claim
	SelectionReason string `json:"selection_reason"`
}

// Parsed JSON upload — examples array for job library input.
type JobExampleLibraryFile struct {
	// Past job rows
	Examples []JobExample `json:"examples"`
}

// Work description + job example library merged by combine.
type JobSelectBundle struct {
	// WorkDescription from Normalize Case
	Case WorkDescription `json:"case"`
	// Job example library side input
	Library JobExampleLibraryFile `json:"library"`
}

// Claim description + selected past jobs — cached context for catalog filtering.
type ItemFilterContext struct {
	// Current claim work description
	Description string `json:"description"`
	// Filtered past jobs
	SelectedExamples []SelectedJobExample `json:"selected_examples"`
}

// One row from the master work-item catalog.
type WorkItem struct {
	// Catalog id
	Id string `json:"id"`
	// Trade code
	Code string `json:"code"`
	// Trade category
	Trade string `json:"trade"`
	// Billing unit
	Unit string `json:"unit"`
	// Line item description
	Description string `json:"description"`
}

// Parsed JSON upload — items array for catalog input.
type WorkItemCatalogFile struct {
	// Master catalog rows
	Items []WorkItem `json:"items"`
}

// Item filter context + work item catalog merged by combine.
type CatalogSelectBundle struct {
	// Description + selected jobs from Merge for Item Filter
	DraftContext ItemFilterContext `json:"draft_context"`
	// Work item catalog side input
	Catalog WorkItemCatalogFile `json:"catalog"`
}

// Relevant catalog row after example-select — includes selection_reason.
type SelectedWorkItem struct {
	// Catalog id
	Id string `json:"id"`
	// Trade code
	Code string `json:"code"`
	// Trade category
	Trade string `json:"trade"`
	// Billing unit
	Unit string `json:"unit"`
	// Line item description
	Description string `json:"description"`
	// Why this catalog item applies to the claim
	SelectionReason string `json:"selection_reason"`
}

// Merged description, jobs, and filtered catalog items for final LLM.
type BilledWorkDraftRequest struct {
	// Current claim
	Description string `json:"description"`
	// Filtered past jobs
	SelectedExamples []SelectedJobExample `json:"selected_examples"`
	// Filtered catalog rows
	SelectedWorkItems []SelectedWorkItem `json:"selected_work_items"`
}

// One billed line on the draft scope.
type DraftLineItem struct {
	// Catalog id
	WorkItemId string `json:"work_item_id"`
	// Proposed quantity
	Quantity float64 `json:"quantity"`
	// Why this line is on the scope
	Rationale string `json:"rationale"`
}

// Draft structured billed work for the new claim.
type BilledWorkDraft struct {
	// Short job title
	Title string `json:"title"`
	// Proposed billed lines
	LineItems []DraftLineItem `json:"line_items"`
}

// Auto-derived merge spine operand.
type WrapSelectedExamples struct {
	// Filtered past jobs
	SelectedExamples []SelectedJobExample `json:"selected_examples"`
}

// Auto-derived merge spine operand.
type WrapSelectedWorkItems struct {
	// Filtered catalog rows
	SelectedWorkItems []SelectedWorkItem `json:"selected_work_items"`
}


// === pipeline state ===
// Pipeline state — step label → spine snapshot (JSON for open typing).
// "Work Description": Document
// "Normalize Case": WorkDescription
// "Job Example Library": JobExampleLibraryFile
// "Combine Job Inputs": JobSelectBundle
// "Parse Job Examples": []JobExample
// "Select Relevant Jobs": []SelectedJobExample
// "Merge for Item Filter": ItemFilterContext
// "Work Item Catalog": WorkItemCatalogFile
// "Combine Catalog": CatalogSelectBundle
// "Parse Work Items": []WorkItem
// "Select Relevant Work Items": []SelectedWorkItem
// "Merge for Draft": BilledWorkDraftRequest
// "Draft Billed Work": BilledWorkDraft
// "Billed Work Output": BilledWorkDraft
type PipelineState map[string]json.RawMessage

// === runtime config (load .env in your runner — pass values here, not in this file) ===
type PipelineRuntime struct {
	LlmProviderID     string
	LlmProviderModel  string
	OpenRouterAPIKey  string
	OpenRouterModel   string
	OpenRouterSiteURL string
	OpenRouterAppTitle string
	VisionOcrModel    string
	// AI : TODO export — Supabase persistence / step cache.
}

var (
	runtimeMu sync.Mutex
	runtimeCfg PipelineRuntime
)

func ConfigurePipelineRuntime(config PipelineRuntime) {
	runtimeMu.Lock()
	defer runtimeMu.Unlock()
	runtimeCfg = config
}

func currentRuntime() PipelineRuntime {
	runtimeMu.Lock()
	defer runtimeMu.Unlock()
	return runtimeCfg
}

// --- runtime stubs (replace bodies or inject via ConfigurePipelineRuntime) ---

const openRouterChatURL = "https://openrouter.ai/api/v1/chat/completions"
const defaultOpenRouterModel = "deepseek/deepseek-chat"

func extractJSONReply(raw string) string {
	body := strings.TrimSpace(raw)
	if i := strings.Index(body, "```"); i >= 0 {
		after := body[i+3:]
		after = strings.TrimPrefix(after, "json")
		after = strings.TrimSpace(after)
		if j := strings.Index(after, "```"); j >= 0 {
			after = after[:j]
		}
		body = strings.TrimSpace(after)
	}
	start := strings.IndexAny(body, "{[")
	if start < 0 {
		start = 0
	}
	end := strings.LastIndexAny(body, "}]")
	if end >= start {
		return body[start : end+1]
	}
	return body
}

func openRouterChat(prompt string, jsonMode bool) (string, error) {
	rt := currentRuntime()
	if rt.OpenRouterAPIKey == "" {
		return "", fmt.Errorf("ConfigurePipelineRuntime first")
	}
	model := rt.OpenRouterModel
	if model == "" {
		model = defaultOpenRouterModel
	}
	site := rt.OpenRouterSiteURL
	if site == "" {
		site = "http://localhost:3000"
	}
	title := rt.OpenRouterAppTitle
	if title == "" {
		title = "forge-pipeline-export"
	}
	payload := map[string]any{
		"model": model,
		"messages": []map[string]string{{"role": "user", "content": prompt}},
		"temperature": 0,
		"max_tokens": 8192,
		"provider": map[string]any{"allow_fallbacks": false},
	}
	if jsonMode {
		payload["response_format"] = map[string]string{"type": "json_object"}
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequest(http.MethodPost, openRouterChatURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+rt.OpenRouterAPIKey)
	req.Header.Set("HTTP-Referer", site)
	req.Header.Set("X-Title", title)
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	respBody, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return "", fmt.Errorf("OpenRouter %s: %s", res.Status, string(respBody))
	}
	var data map[string]any
	if err := json.Unmarshal(respBody, &data); err != nil {
		return "", err
	}
	choices, _ := data["choices"].([]any)
	if len(choices) == 0 {
		return "", fmt.Errorf("OpenRouter returned no message content")
	}
	choice, _ := choices[0].(map[string]any)
	msg, _ := choice["message"].(map[string]any)
	content, _ := msg["content"].(string)
	if content == "" {
		return "", fmt.Errorf("OpenRouter returned no message content")
	}
	return content, nil
}

func llmStructured(prompt string, schema json.RawMessage) (json.RawMessage, error) {
	if currentRuntime().OpenRouterAPIKey == "" {
		return nil, fmt.Errorf("ConfigurePipelineRuntime(OpenRouterAPIKey=...) first")
	}
	var pretty any
	_ = json.Unmarshal(schema, &pretty)
	schemaJSON, _ := json.MarshalIndent(pretty, "", "  ")
	if len(schemaJSON) == 0 {
		schemaJSON = []byte("{}")
	}
	base := prompt + "\n\nRespond with ONLY a JSON value that validates against this JSON Schema:\n" + string(schemaJSON)
	var lastError string
	for attempt := 0; attempt < 2; attempt++ {
		ask := base
		if attempt > 0 {
			ask = base + "\n\nYour previous reply failed validation:\n" + lastError + "\nReturn corrected JSON only."
		}
		raw, err := openRouterChat(ask, true)
		if err != nil {
			return nil, err
		}
		jsonText := extractJSONReply(raw)
		if json.Valid([]byte(jsonText)) {
			return json.RawMessage(jsonText), nil
		}
		lastError = "invalid JSON"
		if attempt == 1 {
			return nil, fmt.Errorf("structured response parse failed after retry: %s", lastError)
		}
	}
	return nil, fmt.Errorf("structured response failed")
}

// === steps ===
// Work Description
// Kind: Input
// New claim narrative — feeds {description} via Normalize Case
// Cached: true
func step_work_description(input Document, _state PipelineState) (Document, error) {
	// Parse uploaded file — built-in parser or vision OCR when enabled
	// Input guard: "Plain-text description of the new repair claim"
	// Filename must contain: "work_description"
	return input, nil
}

// Normalize Case
// Kind: Custom Code
// Document → WorkDescription — deterministic wrapper for example-select context.
// Cached: true
func step_normalize_case(input Document, _state PipelineState) (WorkDescription, error) {
	// TypeScript custom code (1 attempt) (not inlined — port or call via cgo/FFI):
	// (doc) => ({ description: String(doc?.content ?? "").trim() })
	b, err := json.Marshal(input)
	if err != nil {
		return WorkDescription{}, err
	}
	var out WorkDescription
	if err := json.Unmarshal(b, &out); err != nil {
		return WorkDescription{}, err
	}
	return out, nil
}

// Job Example Library
// Kind: Input
// Past jobs with billed_items references — side input before combine
// Cached: true
func step_job_example_library(input Document, _state PipelineState) (JobExampleLibraryFile, error) {
	// Parse uploaded file — built-in parser or vision OCR when enabled
	// Input guard: "JSON file with examples array of structured past jobs"
	// Filename must contain: "job_example_library"
	var parsed any
	if err := json.Unmarshal([]byte(input.Content), &parsed); err != nil {
		return JobExampleLibraryFile{}, err
	}
	b, err := json.Marshal(parsed)
	if err != nil {
		return JobExampleLibraryFile{}, err
	}
	var out JobExampleLibraryFile
	if err := json.Unmarshal(b, &out); err != nil {
		return JobExampleLibraryFile{}, err
	}
	return out, nil
}

// Combine Job Inputs
// Kind: Combine Inputs
// Merges WorkDescription with Job Example Library side input.
// Cached: true
func step_combine_job_inputs(input JobExampleLibraryFile, state PipelineState) (JobSelectBundle, error) {
	// Merge uploaded document with upstream WorkDescription from pipeline state
	newDoc := input
	payload := map[string]any{
			"case": state["Normalize Case"],
			"library": newDoc,
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return JobSelectBundle{}, err
	}
	var merged JobSelectBundle
	if err := json.Unmarshal(b, &merged); err != nil {
		return JobSelectBundle{}, err
	}
	return merged, nil
}

// Parse Job Examples
// Kind: Custom Code
// JobSelectBundle → list[JobExample].
// Cached: true
func step_parse_job_examples(input JobSelectBundle, _state PipelineState) ([]JobExample, error) {
	// TypeScript custom code (1 attempt) (not inlined — port or call via cgo/FFI):
	// (bundle) => { const rows = bundle?.library?.examples; if (!Array.isArray(rows)) throw new Error("expected examples array"); return rows; }
	b, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	var out []JobExample
	if err := json.Unmarshal(b, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// Select Relevant Jobs
// Kind: Example Select
// Pass 1 — filter past jobs by similarity to the claim description.
// Model: openrouter:deepseek-v4
// Cached: true
func step_select_relevant_jobs(input []JobExample, _state PipelineState) ([]SelectedJobExample, error) {
	return input, nil
}

// Merge for Item Filter
// Kind: Merge
// Deep-merge Normalize Case with selected_examples → ItemFilterContext (cached prefix for pass 2).
// Cached: true
func step_merge_for_item_filter(input []SelectedJobExample, _state PipelineState) (ItemFilterContext, error) {
	// TypeScript custom code (1 attempt) (not inlined — port or call via cgo/FFI):
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
	b, err := json.Marshal(input)
	if err != nil {
		return ItemFilterContext{}, err
	}
	var out ItemFilterContext
	if err := json.Unmarshal(b, &out); err != nil {
		return ItemFilterContext{}, err
	}
	return out, nil
}

// Work Item Catalog
// Kind: Input
// 100-item catalog for pass 2 — too large for one prompt; filtered per row with cached prefix
// Cached: true
func step_work_item_catalog(input Document, _state PipelineState) (WorkItemCatalogFile, error) {
	// Parse uploaded file — built-in parser or vision OCR when enabled
	// Input guard: "JSON file with items array — master catalog of billable work items"
	// Filename must contain: "work_item_catalog"
	var parsed any
	if err := json.Unmarshal([]byte(input.Content), &parsed); err != nil {
		return WorkItemCatalogFile{}, err
	}
	b, err := json.Marshal(parsed)
	if err != nil {
		return WorkItemCatalogFile{}, err
	}
	var out WorkItemCatalogFile
	if err := json.Unmarshal(b, &out); err != nil {
		return WorkItemCatalogFile{}, err
	}
	return out, nil
}

// Combine Catalog
// Kind: Combine Inputs
// Merges ItemFilterContext with Work Item Catalog side input.
// Cached: true
func step_combine_catalog(input WorkItemCatalogFile, state PipelineState) (CatalogSelectBundle, error) {
	// Merge uploaded document with upstream ItemFilterContext from pipeline state
	newDoc := input
	payload := map[string]any{
			"draft_context": state["Merge for Item Filter"],
			"catalog": newDoc,
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return CatalogSelectBundle{}, err
	}
	var merged CatalogSelectBundle
	if err := json.Unmarshal(b, &merged); err != nil {
		return CatalogSelectBundle{}, err
	}
	return merged, nil
}

// Parse Work Items
// Kind: Custom Code
// CatalogSelectBundle → list[WorkItem].
// Cached: true
func step_parse_work_items(input CatalogSelectBundle, _state PipelineState) ([]WorkItem, error) {
	// TypeScript custom code (1 attempt) (not inlined — port or call via cgo/FFI):
	// (bundle) => { const rows = bundle?.catalog?.items; if (!Array.isArray(rows)) throw new Error("expected items array"); return rows; }
	b, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	var out []WorkItem
	if err := json.Unmarshal(b, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// Select Relevant Work Items
// Kind: Example Select
// Pass 2 — filter catalog rows; context is full ItemFilterContext JSON (description + selected jobs).
// Model: openrouter:deepseek-v4
// Cached: true
func step_select_relevant_work_items(input []WorkItem, _state PipelineState) ([]SelectedWorkItem, error) {
	return input, nil
}

// Merge for Draft
// Kind: Merge
// Deep-merge ItemFilterContext with selected_work_items → BilledWorkDraftRequest.
// Cached: true
func step_merge_for_draft(input []SelectedWorkItem, _state PipelineState) (BilledWorkDraftRequest, error) {
	// TypeScript custom code (1 attempt) (not inlined — port or call via cgo/FFI):
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
	b, err := json.Marshal(input)
	if err != nil {
		return BilledWorkDraftRequest{}, err
	}
	var out BilledWorkDraftRequest
	if err := json.Unmarshal(b, &out); err != nil {
		return BilledWorkDraftRequest{}, err
	}
	return out, nil
}

// Draft Billed Work
// Kind: LLM Call
// Final structured scope using selected jobs, catalog items, and selection_reason fields.
// Model: openrouter:deepseek-v4
// Cached: true
func step_draft_billed_work(input BilledWorkDraftRequest, _state PipelineState) (BilledWorkDraft, error) {
	// Structured LLM call → BilledWorkDraft
	_ = "openrouter:deepseek-v4"
	inJSON, err := json.MarshalIndent(input, "", "  ")
	if err != nil {
		return BilledWorkDraft{}, err
	}
	userPrompt := "Draft structured billed work for the claim. Use selected_examples for coverage patterns and selected_work_items as the allowed catalog pool — each row includes selection_reason. Pick quantities from past jobs where sensible. Output title and line_items with work_item_id, quantity, and rationale." + "\n\nINPUT DATA:\n" + string(inJSON)
	schema := json.RawMessage([]byte("{}")) // JSON schema for BilledWorkDraft
	value, err := llmStructured(userPrompt, schema)
	if err != nil {
		return BilledWorkDraft{}, err
	}
	var out BilledWorkDraft
	if err := json.Unmarshal(value, &out); err != nil {
		return BilledWorkDraft{}, err
	}
	return out, nil
}

// Billed Work Output
// Kind: Output
// Cached: true
func step_billed_work_output(input BilledWorkDraft, _state PipelineState) (BilledWorkDraft, error) {
	// Snapshot BilledWorkDraft
	return input, nil
}

// === orchestrator ===
func RunPipeline(inputs map[string]Document) (json.RawMessage, error) {
    state := make(PipelineState)
    var spine json.RawMessage
    var err error

    // 1. Work Description
    _out_step_work_description, err := step_work_description(inputs["Work Description"], state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_work_description)
    if err != nil {
        return nil, err
    }
    state["Work Description"] = append(json.RawMessage(nil), spine...)

    // 2. Normalize Case
    var _in_step_normalize_case Document
    if err := json.Unmarshal(spine, &_in_step_normalize_case); err != nil {
        return nil, err
    }
    _out_step_normalize_case, err := step_normalize_case(_in_step_normalize_case, state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_normalize_case)
    if err != nil {
        return nil, err
    }
    state["Normalize Case"] = append(json.RawMessage(nil), spine...)

    // 3. Job Example Library
    _out_step_job_example_library, err := step_job_example_library(inputs["Job Example Library"], state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_job_example_library)
    if err != nil {
        return nil, err
    }
    state["Job Example Library"] = append(json.RawMessage(nil), spine...)

    // 4. Combine Job Inputs
    var _in_step_combine_job_inputs JobExampleLibraryFile
    if err := json.Unmarshal(spine, &_in_step_combine_job_inputs); err != nil {
        return nil, err
    }
    _out_step_combine_job_inputs, err := step_combine_job_inputs(_in_step_combine_job_inputs, state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_combine_job_inputs)
    if err != nil {
        return nil, err
    }
    state["Combine Job Inputs"] = append(json.RawMessage(nil), spine...)

    // 5. Parse Job Examples
    var _in_step_parse_job_examples JobSelectBundle
    if err := json.Unmarshal(spine, &_in_step_parse_job_examples); err != nil {
        return nil, err
    }
    _out_step_parse_job_examples, err := step_parse_job_examples(_in_step_parse_job_examples, state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_parse_job_examples)
    if err != nil {
        return nil, err
    }
    state["Parse Job Examples"] = append(json.RawMessage(nil), spine...)

    // 6. Select Relevant Jobs
    var _in_step_select_relevant_jobs []JobExample
    if err := json.Unmarshal(spine, &_in_step_select_relevant_jobs); err != nil {
        return nil, err
    }
    _out_step_select_relevant_jobs, err := step_select_relevant_jobs(_in_step_select_relevant_jobs, state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_select_relevant_jobs)
    if err != nil {
        return nil, err
    }
    state["Select Relevant Jobs"] = append(json.RawMessage(nil), spine...)

    // 7. Merge for Item Filter
    var _in_step_merge_for_item_filter []SelectedJobExample
    if err := json.Unmarshal(spine, &_in_step_merge_for_item_filter); err != nil {
        return nil, err
    }
    _out_step_merge_for_item_filter, err := step_merge_for_item_filter(_in_step_merge_for_item_filter, state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_merge_for_item_filter)
    if err != nil {
        return nil, err
    }
    state["Merge for Item Filter"] = append(json.RawMessage(nil), spine...)

    // 8. Work Item Catalog
    _out_step_work_item_catalog, err := step_work_item_catalog(inputs["Work Item Catalog"], state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_work_item_catalog)
    if err != nil {
        return nil, err
    }
    state["Work Item Catalog"] = append(json.RawMessage(nil), spine...)

    // 9. Combine Catalog
    var _in_step_combine_catalog WorkItemCatalogFile
    if err := json.Unmarshal(spine, &_in_step_combine_catalog); err != nil {
        return nil, err
    }
    _out_step_combine_catalog, err := step_combine_catalog(_in_step_combine_catalog, state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_combine_catalog)
    if err != nil {
        return nil, err
    }
    state["Combine Catalog"] = append(json.RawMessage(nil), spine...)

    // 10. Parse Work Items
    var _in_step_parse_work_items CatalogSelectBundle
    if err := json.Unmarshal(spine, &_in_step_parse_work_items); err != nil {
        return nil, err
    }
    _out_step_parse_work_items, err := step_parse_work_items(_in_step_parse_work_items, state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_parse_work_items)
    if err != nil {
        return nil, err
    }
    state["Parse Work Items"] = append(json.RawMessage(nil), spine...)

    // 11. Select Relevant Work Items
    var _in_step_select_relevant_work_items []WorkItem
    if err := json.Unmarshal(spine, &_in_step_select_relevant_work_items); err != nil {
        return nil, err
    }
    _out_step_select_relevant_work_items, err := step_select_relevant_work_items(_in_step_select_relevant_work_items, state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_select_relevant_work_items)
    if err != nil {
        return nil, err
    }
    state["Select Relevant Work Items"] = append(json.RawMessage(nil), spine...)

    // 12. Merge for Draft
    var _in_step_merge_for_draft []SelectedWorkItem
    if err := json.Unmarshal(spine, &_in_step_merge_for_draft); err != nil {
        return nil, err
    }
    _out_step_merge_for_draft, err := step_merge_for_draft(_in_step_merge_for_draft, state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_merge_for_draft)
    if err != nil {
        return nil, err
    }
    state["Merge for Draft"] = append(json.RawMessage(nil), spine...)

    // 13. Draft Billed Work
    var _in_step_draft_billed_work BilledWorkDraftRequest
    if err := json.Unmarshal(spine, &_in_step_draft_billed_work); err != nil {
        return nil, err
    }
    _out_step_draft_billed_work, err := step_draft_billed_work(_in_step_draft_billed_work, state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_draft_billed_work)
    if err != nil {
        return nil, err
    }
    state["Draft Billed Work"] = append(json.RawMessage(nil), spine...)

    // 14. Billed Work Output
    var _in_step_billed_work_output BilledWorkDraft
    if err := json.Unmarshal(spine, &_in_step_billed_work_output); err != nil {
        return nil, err
    }
    _out_step_billed_work_output, err := step_billed_work_output(_in_step_billed_work_output, state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_billed_work_output)
    if err != nil {
        return nil, err
    }
    state["Billed Work Output"] = append(json.RawMessage(nil), spine...)

    return spine, nil
}
