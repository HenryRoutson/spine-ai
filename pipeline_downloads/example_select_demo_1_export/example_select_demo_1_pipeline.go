// Generated pipeline export — equivalent Go representation
// Project: Example Select Demo
// 13 steps · 9 structures · 689 lines
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

// New damage case text — fills {description} in the example-select prompt.
type ScopeDescription struct {
	// Plain-language damage description
	Description string `json:"description"`
}

// One reference scope-of-works row from the example library.
type ScopeExample struct {
	// Stable example id
	Id string `json:"id"`
	// Short label
	Title string `json:"title"`
	// Past scope of works body
	ScopeText string `json:"scope_text"`
}

// Relevant example after example-select — includes selection_reason chain-of-thought.
type SelectedExample struct {
	// Matches library id
	Id string `json:"id"`
	// Short label
	Title string `json:"title"`
	// Past scope body
	ScopeText string `json:"scope_text"`
	// Why this example is useful for the current case
	SelectionReason string `json:"selection_reason"`
}

// Merged description + filtered examples for the final LLM.
type ScopeDraftRequest struct {
	// Current damage case
	Description string `json:"description"`
	// LLM-filtered reference rows
	SelectedExamples []SelectedExample `json:"selected_examples"`
}

// Parsed JSON upload — examples array for the library input step.
type ExampleLibraryFile struct {
	// Reference scope rows
	Examples []ScopeExample `json:"examples"`
}

// Damage case + example library merged by combine.
type ScopeSelectBundle struct {
	// ScopeDescription from Normalize Case (pipeline state)
	Case ScopeDescription `json:"case"`
	// Example library from the side input
	Library ExampleLibraryFile `json:"library"`
}

// Draft scope of works for the new case.
type ScopeDraft struct {
	// Short job title
	Title string `json:"title"`
	// Numbered scope lines
	ScopeOfWorks string `json:"scope_of_works"`
}


// === pipeline state ===
// Pipeline state — step label → spine snapshot (JSON for open typing).
// "Damage Case": Document
// "Normalize Case": ScopeDescription
// "Example Library": ExampleLibraryFile
// "Combine Inputs": ScopeSelectBundle
// "Parse Examples": []ScopeExample
// "Select Relevant Examples": []SelectedExample
// "Merge for Draft": ScopeDraftRequest
// "Draft Scope": ScopeDraft
// "✓ Combine Inputs": ScopeSelectBundle
// "✓ Normalize Case": ScopeDescription
// "✓ Parse Examples": []ScopeExample
// "✓ Select Relevant Examples": []SelectedExample
// "Scope Output": ScopeDraft
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
// Damage Case
// Kind: Input
// New leak description — feeds {description} via Normalize Case
// Cached: true
func step_damage_case(input Document, _state PipelineState) (Document, error) {
	// Parse uploaded file — built-in parser or vision OCR when enabled
	// Input guard: "Plain-text description of the new damage case"
	// Filename must contain: "damage_case"
	return input, nil
}

// Normalize Case
// Kind: Custom Code
// Document → ScopeDescription — deterministic wrapper for the example-select context label.
// Cached: true
func step_normalize_case(input Document, _state PipelineState) (ScopeDescription, error) {
	// TypeScript custom code (1 attempt) (not inlined — port or call via cgo/FFI):
	// (doc) => ({ description: String(doc?.content ?? "").trim() })
	b, err := json.Marshal(input)
	if err != nil {
		return ScopeDescription{}, err
	}
	var out ScopeDescription
	if err := json.Unmarshal(b, &out); err != nil {
		return ScopeDescription{}, err
	}
	return out, nil
}

// Example Library
// Kind: Input
// Reference example library — side input for combine (must follow Normalize Case on spine)
// Cached: true
func step_example_library(input Document, _state PipelineState) (ExampleLibraryFile, error) {
	// Parse uploaded file — built-in parser or vision OCR when enabled
	// Input guard: "JSON file with examples array of past scope-of-works rows"
	// Filename must contain: "example_library"
	var parsed any
	if err := json.Unmarshal([]byte(input.Content), &parsed); err != nil {
		return ExampleLibraryFile{}, err
	}
	b, err := json.Marshal(parsed)
	if err != nil {
		return ExampleLibraryFile{}, err
	}
	var out ExampleLibraryFile
	if err := json.Unmarshal(b, &out); err != nil {
		return ExampleLibraryFile{}, err
	}
	return out, nil
}

// Combine Inputs
// Kind: Combine Inputs
// Merges ScopeDescription (pipeline state) with Example Library side input — required after input → code → input.
// Cached: true
func step_combine_inputs(input ExampleLibraryFile, state PipelineState) (ScopeSelectBundle, error) {
	// Merge uploaded document with upstream ScopeDescription from pipeline state
	newDoc := input
	payload := map[string]any{
			"case": state["Normalize Case"],
			"library": newDoc,
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return ScopeSelectBundle{}, err
	}
	var merged ScopeSelectBundle
	if err := json.Unmarshal(b, &merged); err != nil {
		return ScopeSelectBundle{}, err
	}
	return merged, nil
}

// Parse Examples
// Kind: Custom Code
// ScopeSelectBundle → list[ScopeExample] — examples from the merged library field.
// Cached: true
func step_parse_examples(input ScopeSelectBundle, _state PipelineState) ([]ScopeExample, error) {
	// TypeScript custom code (1 attempt) (not inlined — port or call via cgo/FFI):
	// (bundle) => { const rows = bundle?.library?.examples; if (!Array.isArray(rows)) throw new Error("expected examples array"); return rows; }
	b, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	var out []ScopeExample
	if err := json.Unmarshal(b, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// Select Relevant Examples
// Kind: Example Select
// LLM relevance filter — cached prefix + per-item is_relevant; not embedding RAG.
// Model: deepseek-v4
// Cached: true
func step_select_relevant_examples(input []ScopeExample, _state PipelineState) ([]SelectedExample, error) {
	return input, nil
}

// Merge for Draft
// Kind: Custom Code
// list[SelectedExample] + description from Normalize Case on pipeline state → ScopeDraftRequest for the final LLM.
// Cached: true
func step_merge_for_draft(input SelectedExample, _state PipelineState) (ScopeDraftRequest, error) {
	// TypeScript custom code (1 attempt) (not inlined — port or call via cgo/FFI):
	// (selected, state) => { const norm = (state ?? {})["Normalize Case"]; const description = norm && typeof norm === "object" && norm !== null && typeof norm.description === "string" ? norm.description : ""; return { description, selected_examples: Array.isArray(selected) ? selected : [] }; }
	b, err := json.Marshal(input)
	if err != nil {
		return ScopeDraftRequest{}, err
	}
	var out ScopeDraftRequest
	if err := json.Unmarshal(b, &out); err != nil {
		return ScopeDraftRequest{}, err
	}
	return out, nil
}

// Draft Scope
// Kind: LLM Call
// Final scope using selected examples and their selection_reason fields.
// Model: deepseek-v4
// Cached: true
func step_draft_scope(input ScopeDraftRequest, _state PipelineState) (ScopeDraft, error) {
	// Structured LLM call → ScopeDraft
	_ = "deepseek-v4"
	inJSON, err := json.MarshalIndent(input, "", "  ")
	if err != nil {
		return ScopeDraft{}, err
	}
	userPrompt := "Write a numbered scope of works for the damage description. Use selected_examples only as style and coverage guidance — each row includes selection_reason explaining why it was chosen. Do not copy irrelevant work from distractor examples. Output a concise title and scope_of_works." + "\n\nINPUT DATA:\n" + string(inJSON)
	schema := json.RawMessage([]byte("{}")) // JSON schema for ScopeDraft
	value, err := llmStructured(userPrompt, schema)
	if err != nil {
		return ScopeDraft{}, err
	}
	var out ScopeDraft
	if err := json.Unmarshal(value, &out); err != nil {
		return ScopeDraft{}, err
	}
	return out, nil
}

// ✓ Combine Inputs
// Kind: Assert
// Structural check — combine retained case description and library examples
// Cached: true
func step_8_combine_inputs(input ScopeDraft, _state PipelineState) (ScopeDraft, error) {
	// typescript assert (not inlined — port or call via cgo/FFI):
	// const b = step("Combine Inputs");
	// if (!b?.case?.description || typeof b.case.description !== "string" || !b.case.description.trim()) throw new Error("combine missing case.description");
	// if (!Array.isArray(b?.library?.examples) || b.library.examples.length < 1) throw new Error("combine missing library.examples");
	// Validate pipeline state — passthrough on success
	return input, nil
}

// ✓ Normalize Case
// Kind: Assert
// Golden fixture — damage text wrapped as ScopeDescription
// Cached: true
func step_9_normalize_case(input ScopeSelectBundle, _state PipelineState) (ScopeSelectBundle, error) {
	// typescript assert (not inlined — port or call via cgo/FFI):
	// assertEqual(step("Normalize Case"), "Normalize Case");
	// Validate pipeline state — passthrough on success
	return input, nil
}

// ✓ Parse Examples
// Kind: Assert
// Golden fixture — four library rows parsed
// Cached: true
func step_10_parse_examples(input ScopeDescription, _state PipelineState) (ScopeDescription, error) {
	// typescript assert (not inlined — port or call via cgo/FFI):
	// assertEqual(step("Parse Examples"), "Parse Examples");
	// Validate pipeline state — passthrough on success
	return input, nil
}

// ✓ Select Relevant Examples
// Kind: Assert
// Structural check — selected ids must exist in Example Library / Combine Inputs / Parse Examples
// Cached: true
func step_11_select_relevant_examples(input []ScopeExample, _state PipelineState) ([]ScopeExample, error) {
	// typescript assert (not inlined — port or call via cgo/FFI):
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
	return input, nil
}

// Scope Output
// Kind: Output
// Cached: true
func step_scope_output(input []SelectedExample, _state PipelineState) ([]SelectedExample, error) {
	// Snapshot ScopeDraft
	return input, nil
}

// === orchestrator ===
func RunPipeline(inputs map[string]Document) (json.RawMessage, error) {
    state := make(PipelineState)
    var spine json.RawMessage
    var err error

    // 1. Damage Case
    _out_step_damage_case, err := step_damage_case(inputs["Damage Case"], state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_damage_case)
    if err != nil {
        return nil, err
    }
    state["Damage Case"] = append(json.RawMessage(nil), spine...)

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

    // 3. Example Library
    _out_step_example_library, err := step_example_library(inputs["Example Library"], state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_example_library)
    if err != nil {
        return nil, err
    }
    state["Example Library"] = append(json.RawMessage(nil), spine...)

    // 4. Combine Inputs
    var _in_step_combine_inputs ExampleLibraryFile
    if err := json.Unmarshal(spine, &_in_step_combine_inputs); err != nil {
        return nil, err
    }
    _out_step_combine_inputs, err := step_combine_inputs(_in_step_combine_inputs, state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_combine_inputs)
    if err != nil {
        return nil, err
    }
    state["Combine Inputs"] = append(json.RawMessage(nil), spine...)

    // 5. Parse Examples
    var _in_step_parse_examples ScopeSelectBundle
    if err := json.Unmarshal(spine, &_in_step_parse_examples); err != nil {
        return nil, err
    }
    _out_step_parse_examples, err := step_parse_examples(_in_step_parse_examples, state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_parse_examples)
    if err != nil {
        return nil, err
    }
    state["Parse Examples"] = append(json.RawMessage(nil), spine...)

    // 6. Select Relevant Examples
    var _in_step_select_relevant_examples []ScopeExample
    if err := json.Unmarshal(spine, &_in_step_select_relevant_examples); err != nil {
        return nil, err
    }
    _out_step_select_relevant_examples, err := step_select_relevant_examples(_in_step_select_relevant_examples, state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_select_relevant_examples)
    if err != nil {
        return nil, err
    }
    state["Select Relevant Examples"] = append(json.RawMessage(nil), spine...)

    // 7. Merge for Draft
    var _in_step_merge_for_draft SelectedExample
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

    // 8. Draft Scope
    var _in_step_draft_scope ScopeDraftRequest
    if err := json.Unmarshal(spine, &_in_step_draft_scope); err != nil {
        return nil, err
    }
    _out_step_draft_scope, err := step_draft_scope(_in_step_draft_scope, state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_draft_scope)
    if err != nil {
        return nil, err
    }
    state["Draft Scope"] = append(json.RawMessage(nil), spine...)

    // 9. ✓ Combine Inputs
    var _in_step_8_combine_inputs ScopeDraft
    if err := json.Unmarshal(spine, &_in_step_8_combine_inputs); err != nil {
        return nil, err
    }
    _out_step_8_combine_inputs, err := step_8_combine_inputs(_in_step_8_combine_inputs, state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_8_combine_inputs)
    if err != nil {
        return nil, err
    }
    state["✓ Combine Inputs"] = append(json.RawMessage(nil), spine...)

    // 10. ✓ Normalize Case
    var _in_step_9_normalize_case ScopeSelectBundle
    if err := json.Unmarshal(spine, &_in_step_9_normalize_case); err != nil {
        return nil, err
    }
    _out_step_9_normalize_case, err := step_9_normalize_case(_in_step_9_normalize_case, state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_9_normalize_case)
    if err != nil {
        return nil, err
    }
    state["✓ Normalize Case"] = append(json.RawMessage(nil), spine...)

    // 11. ✓ Parse Examples
    var _in_step_10_parse_examples ScopeDescription
    if err := json.Unmarshal(spine, &_in_step_10_parse_examples); err != nil {
        return nil, err
    }
    _out_step_10_parse_examples, err := step_10_parse_examples(_in_step_10_parse_examples, state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_10_parse_examples)
    if err != nil {
        return nil, err
    }
    state["✓ Parse Examples"] = append(json.RawMessage(nil), spine...)

    // 12. ✓ Select Relevant Examples
    var _in_step_11_select_relevant_examples []ScopeExample
    if err := json.Unmarshal(spine, &_in_step_11_select_relevant_examples); err != nil {
        return nil, err
    }
    _out_step_11_select_relevant_examples, err := step_11_select_relevant_examples(_in_step_11_select_relevant_examples, state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_11_select_relevant_examples)
    if err != nil {
        return nil, err
    }
    state["✓ Select Relevant Examples"] = append(json.RawMessage(nil), spine...)

    // 13. Scope Output
    var _in_step_scope_output []SelectedExample
    if err := json.Unmarshal(spine, &_in_step_scope_output); err != nil {
        return nil, err
    }
    _out_step_scope_output, err := step_scope_output(_in_step_scope_output, state)
    if err != nil {
        return nil, err
    }
    spine, err = json.Marshal(_out_step_scope_output)
    if err != nil {
        return nil, err
    }
    state["Scope Output"] = append(json.RawMessage(nil), spine...)

    return spine, nil
}
