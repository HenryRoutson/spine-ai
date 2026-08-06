// Generated pipeline export — BAML (https://github.com/boundaryml/baml)
// Project: Example Select Demo 2 1
// 14 steps · 18 structures · 219 lines
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

// New claim work description — fills {description} in the first example-select pass.
class WorkDescription {
  description string @description("Plain-language damage description")
}

// Reference to a catalog work item on a past job.
class BilledLineRef {
  work_item_id string @description("Catalog work item id")
  quantity float @description("Billed quantity")
  unit_note string? @description("Optional unit clarification")
}

// One past repair job from the example library.
class JobExample {
  id string @description("Stable job example id")
  title string @description("Short label")
  work_description string @description("Past claim narrative")
  billed_items BilledLineRef[] @description("Structured billed work references")
}

// Relevant past job after example-select — includes selection_reason.
class SelectedJobExample {
  id string @description("Matches library id")
  title string @description("Short label")
  work_description string @description("Past claim narrative")
  billed_items BilledLineRef[] @description("Structured billed work references")
  selection_reason string @description("Why this job is useful for the current claim")
}

// Parsed JSON upload — examples array for job library input.
class JobExampleLibraryFile {
  examples JobExample[] @description("Past job rows")
}

// Work description + job example library merged by combine.
class JobSelectBundle {
  case WorkDescription @description("WorkDescription from Normalize Case")
  library JobExampleLibraryFile @description("Job example library side input")
}

// Claim description + selected past jobs — cached context for catalog filtering.
class ItemFilterContext {
  description string @description("Current claim work description")
  selected_examples SelectedJobExample[] @description("Filtered past jobs")
}

// One row from the master work-item catalog.
class WorkItem {
  id string @description("Catalog id")
  code string @description("Trade code")
  trade string @description("Trade category")
  unit string @description("Billing unit")
  description string @description("Line item description")
}

// Parsed JSON upload — items array for catalog input.
class WorkItemCatalogFile {
  items WorkItem[] @description("Master catalog rows")
}

// Item filter context + work item catalog merged by combine.
class CatalogSelectBundle {
  draft_context ItemFilterContext @description("Description + selected jobs from Merge for Item Filter")
  catalog WorkItemCatalogFile @description("Work item catalog side input")
}

// Relevant catalog row after example-select — includes selection_reason.
class SelectedWorkItem {
  id string @description("Catalog id")
  code string @description("Trade code")
  trade string @description("Trade category")
  unit string @description("Billing unit")
  description string @description("Line item description")
  selection_reason string @description("Why this catalog item applies to the claim")
}

// Merged description, jobs, and filtered catalog items for final LLM.
class BilledWorkDraftRequest {
  description string @description("Current claim")
  selected_examples SelectedJobExample[] @description("Filtered past jobs")
  selected_work_items SelectedWorkItem[] @description("Filtered catalog rows")
}

// One billed line on the draft scope.
class DraftLineItem {
  work_item_id string @description("Catalog id")
  quantity float @description("Proposed quantity")
  rationale string @description("Why this line is on the scope")
}

// Draft structured billed work for the new claim.
class BilledWorkDraft {
  title string @description("Short job title")
  line_items DraftLineItem[] @description("Proposed billed lines")
}

// Auto-derived merge spine operand.
class WrapSelectedExamples {
  selected_examples SelectedJobExample[] @description("Filtered past jobs")
}

// Auto-derived merge spine operand.
class WrapSelectedWorkItems {
  selected_work_items SelectedWorkItem[] @description("Filtered catalog rows")
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
// Draft Billed Work · LLM Call → BilledWorkDraft
// Final structured scope using selected jobs, catalog items, and selection_reason fields.
function DraftBilledWork(input: BilledWorkDraftRequest) -> BilledWorkDraft {
  client OpenRouterDeepseekDeepseekChat
  prompt #"
    Draft structured billed work for the claim. Use selected_examples for coverage patterns and selected_work_items as the allowed catalog pool — each row includes selection_reason. Pick quantities from past jobs where sensible. Output title and line_items with work_item_id, quantity, and rationale.

    {{ _.role("user") }}
    {{ input }}

    {{ ctx.output_format }}
  "#
}

// === non-LLM steps (orchestrate in host language) ===
// --- step 0: Work Description (Input) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_work_description)
// note: New claim narrative — feeds {description} via Normalize Case

// --- step 1: Normalize Case (Custom Code) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_normalize_case)
// note: Document → WorkDescription — deterministic wrapper for example-select context.

// --- step 2: Job Example Library (Input) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_job_example_library)
// note: Past jobs with billed_items references — side input before combine

// --- step 3: Combine Job Inputs (Combine Inputs) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_combine_job_inputs)
// note: Merges WorkDescription with Job Example Library side input.

// --- step 4: Parse Job Examples (Custom Code) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_parse_job_examples)
// note: JobSelectBundle → list[JobExample].

// --- step 5: Select Relevant Jobs (Example Select) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_select_relevant_jobs)
// note: Pass 1 — filter past jobs by similarity to the claim description.

// --- step 6: Merge for Item Filter (Merge) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_merge_for_item_filter)
// note: Deep-merge Normalize Case with selected_examples → ItemFilterContext (cached prefix for pass 2).

// --- step 7: Work Item Catalog (Input) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_work_item_catalog)
// note: 100-item catalog for pass 2 — too large for one prompt; filtered per row with cached prefix

// --- step 8: Combine Catalog (Combine Inputs) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_combine_catalog)
// note: Merges ItemFilterContext with Work Item Catalog side input.

// --- step 9: Parse Work Items (Custom Code) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_parse_work_items)
// note: CatalogSelectBundle → list[WorkItem].

// --- step 10: Select Relevant Work Items (Example Select) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_select_relevant_work_items)
// note: Pass 2 — filter catalog rows; context is full ItemFilterContext JSON (description + selected jobs).

// --- step 11: Merge for Draft (Merge) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_merge_for_draft)
// note: Deep-merge ItemFilterContext with selected_work_items → BilledWorkDraftRequest.

// --- step 13: Billed Work Output (Output) — host language, not BAML ---
// wire in Python/TS via baml_client after non-LLM steps (step_billed_work_output)
