// Generated pipeline export — BAML (https://github.com/boundaryml/baml)
// Project: Example Select Demo
// 13 steps · 9 structures · 152 lines
// Setup: copy .env.example → .env (OPENROUTER_API_KEY), then `baml generate`
// Host: call generated baml_client from Python or TypeScript for orchestration.

// === structures ===
// Generated BAML types — https://github.com/boundaryml/baml
// datetime / json / set / tuple map to string or list (BAML limitations).

class QuoteSpan {
  doc_id string @description("Source document hash")
  start int @description("Start offset in the source")
  end int @description("End offset in the source")
}

class TextQuote {
  text string
  quote QuoteSpan
}

class Document {
  content string @description("Full extracted text of the file")
  filename string @description("Original upload filename")
}

class FileInput {
  content string
  filename string
}

type Quote = QuoteSpan
type quote_string_t = string
type quote_span_t = QuoteSpan
type text_quote_t = TextQuote

// New damage case text — fills {description} in the example-select prompt.
class ScopeDescription {
  description string @description("Plain-language damage description")
}

// One reference scope-of-works row from the example library.
class ScopeExample {
  id string @description("Stable example id")
  title string @description("Short label")
  scope_text string @description("Past scope of works body")
}

// Relevant example after example-select — includes selection_reason chain-of-thought.
class SelectedExample {
  id string @description("Matches library id")
  title string @description("Short label")
  scope_text string @description("Past scope body")
  selection_reason string @description("Why this example is useful for the current case")
}

// Merged description + filtered examples for the final LLM.
class ScopeDraftRequest {
  description string @description("Current damage case")
  selected_examples SelectedExample[] @description("LLM-filtered reference rows")
}

// Parsed JSON upload — examples array for the library input step.
class ExampleLibraryFile {
  examples ScopeExample[] @description("Reference scope rows")
}

// Damage case + example library merged by combine.
class ScopeSelectBundle {
  case ScopeDescription @description("ScopeDescription from Normalize Case (pipeline state)")
  library ExampleLibraryFile @description("Example library from the side input")
}

// Draft scope of works for the new case.
class ScopeDraft {
  title string @description("Short job title")
  scope_of_works string @description("Numbered scope lines")
}


// === LLM clients ===
client<llm> OpenRouterDeepseekDeepseekChat {
  provider openrouter
  options {
    model "deepseek/deepseek-chat"
    // api_key from env.OPENROUTER_API_KEY
  }
}

// === LLM steps ===
// Draft Scope · LLM Call → ScopeDraft
// Final scope using selected examples and their selection_reason fields.
function DraftScope(input: ScopeDraftRequest) -> ScopeDraft {
  client OpenRouterDeepseekDeepseekChat
  prompt #"
    Write a numbered scope of works for the damage description. Use selected_examples only as style and coverage guidance — each row includes selection_reason explaining why it was chosen. Do not copy irrelevant work from distractor examples. Output a concise title and scope_of_works.

    {{ _.role("user") }}
    {{ input }}

    {{ ctx.output_format }}
  "#
}

// === non-LLM steps (orchestrate in host language) ===
// --- step 0: Damage Case (Input) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_damage_case)
// note: New leak description — feeds {description} via Normalize Case

// --- step 1: Normalize Case (Custom Code) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_normalize_case)
// note: Document → ScopeDescription — deterministic wrapper for the example-select context label.

// --- step 2: Example Library (Input) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_example_library)
// note: Reference example library — side input for combine (must follow Normalize Case on spine)

// --- step 3: Combine Inputs (Combine Inputs) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_combine_inputs)
// note: Merges ScopeDescription (pipeline state) with Example Library side input — required after input → code → input.

// --- step 4: Parse Examples (Custom Code) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_parse_examples)
// note: ScopeSelectBundle → list[ScopeExample] — examples from the merged library field.

// --- step 5: Select Relevant Examples (Example Select) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_select_relevant_examples)
// note: LLM relevance filter — cached prefix + per-item is_relevant; not embedding RAG.

// --- step 6: Merge for Draft (Custom Code) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_merge_for_draft)
// note: list[SelectedExample] + description from Normalize Case on pipeline state → ScopeDraftRequest for the final LLM.

// --- step 8: ✓ Combine Inputs (Assert) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_8_combine_inputs)
// note: Structural check — combine retained case description and library examples

// --- step 9: ✓ Normalize Case (Assert) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_9_normalize_case)
// note: Golden fixture — damage text wrapped as ScopeDescription

// --- step 10: ✓ Parse Examples (Assert) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_10_parse_examples)
// note: Golden fixture — four library rows parsed

// --- step 11: ✓ Select Relevant Examples (Assert) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_11_select_relevant_examples)
// note: Structural check — selected ids must exist in Example Library / Combine Inputs / Parse Examples

// --- step 12: Scope Output (Output) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_scope_output)
