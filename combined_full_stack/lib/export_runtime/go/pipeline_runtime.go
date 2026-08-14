// AI : export runtime library — copied into pipeline zips as pipeline_runtime.go (not generated).
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

// === runtime config (load .env in your runner — pass values here, not in this file) ===
type PipelineRuntime struct {
	LlmProviderID     string
	LlmProviderModel  string
	OpenRouterAPIKey  string
	OpenRouterModel   string
	OpenRouterSiteURL string
	OpenRouterAppTitle string
	OpenRouterBaseURL string
	OpenRouterSeed    int
	VisionOcrModel    string
	SourceText  string
	SourceDocID string
	// Wire WaitForHumanReview below — no callback field in this stub.
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

func resolveOpenRouterChatURL(base string) string {
	base = strings.TrimSpace(base)
	if base == "" {
		return openRouterChatURL
	}
	if strings.Contains(base, "/chat/completions") {
		return base
	}
	return strings.TrimRight(base, "/") + "/chat/completions"
}

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
	url := resolveOpenRouterChatURL(rt.OpenRouterBaseURL)
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
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
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

// AI : shared example-select verdict — reused by every example-select step
var relevanceSchema = json.RawMessage([]byte("{\"chain_of_thought\":\"string\",\"is_relevant\":\"boolean\"}"))

func resolveQuotes(data any, sourceText, docID string) (json.RawMessage, error) {
	rt := currentRuntime()
	text := rt.SourceText
	if text == "" {
		text = sourceText
	}
	did := rt.SourceDocID
	if did == "" {
		did = docID
	}
	if text == "" || did == "" {
		return nil, fmt.Errorf("ConfigurePipelineRuntime(SourceText=..., SourceDocID=...) for quote steps")
	}
	_ = data
	return nil, fmt.Errorf("wire resolveQuotes to your quote linker")
}

func WaitForHumanReview(_input any) error {
	return fmt.Errorf("wire WaitForHumanReview")
}

func WaitForChatbotSession(_input any, _mode string) (any, error) {
	return nil, fmt.Errorf("wire WaitForChatbotSession")
}

type WebhookOpts struct {
	URLEnv       string
	Method       string
	AuthEnv      string
	IncludeState bool
	ResponsePath string
	TimeoutMs    int
}

func CallWebhook(_input any, _state any, _opts WebhookOpts) (json.RawMessage, error) {
	return nil, fmt.Errorf("wire CallWebhook — set WEBHOOK_URL_* env vars")
}
func mergeFold(values []any, policy any) any {
	if len(values) == 0 {
		return nil
	}
	result := values[0]
	for i := 1; i < len(values); i++ {
		result = mergePair(result, values[i], policy)
	}
	return result
}

func mergePair(left, right, policy any) any {
	if left == nil {
		return right
	}
	if right == nil {
		return left
	}
	lm, lok := left.(map[string]any)
	rm, rok := right.(map[string]any)
	if lok && rok {
		out := map[string]any{}
		for k, v := range lm {
			out[k] = v
		}
		for k, v := range rm {
			if prev, ok := out[k]; ok {
				out[k] = mergePair(prev, v, policy)
			} else {
				out[k] = v
			}
		}
		return out
	}
	ll, lok := left.([]any)
	rl, rok := right.([]any)
	if lok && rok {
		return append(append([]any{}, ll...), rl...)
	}
	return right
}

func selectRelevant(items []json.RawMessage, description, template string) ([]json.RawMessage, error) {
	out := make([]json.RawMessage, 0, len(items))
	for _, item := range items {
		ask := strings.ReplaceAll(strings.ReplaceAll(template, "{description}", description), "{example}", string(item))
		value, err := llmStructured(ask, relevanceSchema)
		if err != nil {
			return nil, err
		}
		var verdict map[string]any
		if err := json.Unmarshal(value, &verdict); err != nil {
			return nil, err
		}
		if relevant, _ := verdict["is_relevant"].(bool); !relevant {
			continue
		}
		var row map[string]any
		if err := json.Unmarshal(item, &row); err != nil || row == nil {
			var primitive any
			_ = json.Unmarshal(item, &primitive)
			row = map[string]any{"value": primitive}
		}
		if reason, ok := verdict["chain_of_thought"].(string); ok {
			row["selection_reason"] = reason
		}
		b, err := json.Marshal(row)
		if err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, nil
}
