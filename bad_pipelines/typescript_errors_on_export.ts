// Generated pipeline export — equivalent TypeScript representation
// Project: Legacy CRM Migration 1
// 6 steps · 11 structures · 223 lines
// Setup: export also includes .env.example and SETUP.md — copy .env.example → .env

// === structures ===
export type QuoteSpan = { doc_id: string; start: number; end: number };
export type Quote = QuoteSpan;
export type TextQuote = { text: string; quote: QuoteSpan };
export type Document = { content: string; filename: string };
export type FileInput = Document;
export type quote_string_t = string;
export type quote_span_t = QuoteSpan;
export type text_quote_t = { text: string; quote: string };
export type LegacyUser = {
  ID: number;
  FullName: string;
  EMAIL_ADDR: string;
  signup: string;
  addr_street: string;
  addr_city: string | undefined;
  is_active: string;
  fax: string | undefined;
};

export type MigrationInput = {
  mapping: Document;
  legacy_users: LegacyUser[];
};

export type Address = {
  street: string;
  city: string | undefined;
};

export type MigratedUser = {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  signed_up_at: string;
  address: Address;
  active: boolean;
  plan: string;
};

export type MappingRule = {
  source: string;
};

export type Structure_1 = {
  user_id: MappingRule;
  first_name: MappingRule;
  last_name: MappingRule;
  email: MappingRule;
  signed_up_at: MappingRule;
  addressstreet: MappingRule;
  addresscity: MappingRule;
  active: MappingRule;
  plan: MappingRule;
};

export type DatabaseMigrationTestingInputs = {
  legacy_users: string[];
  field_mapping_input: string;
};

export type DatabaseMigrationTestingExpectedoutputs = {
  migrated_users: string | undefined;
};

export type Structure_2 = {
  description: string;
  inputs: DatabaseMigrationTestingInputs;
  expectedoutputs: DatabaseMigrationTestingExpectedoutputs;
};


// === pipeline state ===
export type PipelineState = {
  "Legacy Users": LegacyUser[];
  "Human Review": LegacyUser[];
  "Field Mapping Input": Document;
  "Combine Inputs": MigrationInput;
  "Apply Field Mapping": MigratedUser[];
  "Migrated Users": MigratedUser[];
};

// === runtime config (load .env in your runner — pass values here, not in this file) ===
export type PipelineRuntime = {
  onHumanReview?: <T>(input: T) => Promise<void>;
  // AI : TODO export — Supabase persistence (supabaseUrl, supabaseServiceKey).
  // AI : TODO export — step cache (enableCache, cacheUrl / PIPELINE_CACHE_URL).
};

let runtime: PipelineRuntime = {};

export function configurePipelineRuntime(config: PipelineRuntime): void {
  runtime = { ...runtime, ...config };
}

// --- runtime stubs (replace bodies or inject via configurePipelineRuntime) ---

async function waitForHumanReview<T>(input: T): Promise<void> {
  if (runtime.onHumanReview) {
    await runtime.onHumanReview(input);
    return;
  }
  throw new Error("wire waitForHumanReview or configurePipelineRuntime({ onHumanReview })");
}

// === steps ===
/**
 * Legacy Users
 * @kind Input
 * JSON array of legacy user records with old field names and formats
 * @cached true
 */
async function step_Legacy_Users(input: Document, _state: PipelineState): Promise<LegacyUser[]> {
  // Parse uploaded file — built-in parser or vision OCR when enabled
  // Input guard: "JSON array of legacy user records with old field names and formats"
  // Filename must contain: "legacy_users"
  const doc = input as Document;
  const parsed = JSON.parse(doc.content) as unknown;
  return (Array.isArray(parsed) ? parsed : [parsed]) as LegacyUser[];
}

/**
 * Human Review
 * @kind Human Review
 * @cached true
 */
async function step_Human_Review(input: LegacyUser[], _state: PipelineState): Promise<LegacyUser[]> {
  // Pause for operator approval in Inference tab
  await waitForHumanReview(input);
  return input as unknown as LegacyUser[];
}

/**
 * Field Mapping Input
 * @kind Input
 * JSON field-mapping spec — source columns, transforms, defaults, and target paths
 * @cached true
 */
async function step_Field_Mapping_Input(input: Document, _state: PipelineState): Promise<Document> {
  // Parse uploaded file — built-in parser or vision OCR when enabled
  // Input guard: "JSON field-mapping spec — source columns, transforms, defaults, and target paths"
  // Filename must contain: "field_mapping"
  const doc = input as Document;
  return { content: doc.content, filename: doc.filename };
}

/**
 * Combine Inputs
 * @kind Combine Inputs
 * Builds {"mapping", "legacy_users"}
 * @cached true
 */
async function step_Combine_Inputs(input: Document, state: PipelineState): Promise<MigrationInput> {
  // Merge uploaded document with upstream LegacyUser from pipeline state
  const newDoc = Array.isArray(input) ? input[0] : input;
  const merged = { mapping: newDoc as Document, legacy_users: state["Legacy Users"] };
  return merged as MigrationInput;
}

/**
 * Apply Field Mapping
 * @kind Custom Code
 * Driven entirely by the mapping spec: transform registry, dotted targets nest, missing source → default else null, unmapped legacy fields dropped.
 * @cached true
 */
async function step_Apply_Field_Mapping(input: MigrationInput, state: PipelineState): Promise<MigratedUser[]> {
  const __compiled = new Function("return " + "((input) => {\n  const spec = JSON.parse(input.mapping.content).fields;\n  const transforms = {\n    lowercase: (v) => String(v).toLowerCase(),\n    first_word: (v) => String(v).trim().split(/\\s+/)[0],\n    last_word: (v) => String(v).trim().split(/\\s+/).pop(),\n    yn_to_bool: (v) => v === 'Y',\n    ddmmyyyy_to_iso: (v) => { const [d, m, y] = String(v).split('/'); return y + '-' + m + '-' + d; }\n  };\n  const setPath = (obj, path, v) => {\n    const keys = path.split('.');\n    let cur = obj;\n    for (const k of keys.slice(0, -1)) cur = cur[k] = cur[k] ?? {};\n    cur[keys[keys.length - 1]] = v;\n  };\n  return input.legacy_users.map((rec) => {\n    const out = {};\n    for (const [target, s] of Object.entries(spec)) {\n      const raw = s.source === undefined ? undefined : rec[s.source];\n      setPath(out, target, raw === undefined ? (s.default === undefined ? null : s.default) : s.transform ? transforms[s.transform](raw) : raw);\n    }\n    return out;\n  });\n})")() as (input: MigrationInput, state?: PipelineState) => MigratedUser[];
  return (__compiled.length >= 2 ? __compiled(input, state) : __compiled(input)) as MigratedUser[];
}

/**
 * Migrated Users
 * @kind Output
 * @cached true
 */
async function step_Migrated_Users(input: MigratedUser[], _state: PipelineState): Promise<MigratedUser[]> {
  // Snapshot MigratedUser
  return input as unknown as MigratedUser[];
}

// === orchestrator ===
export type PipelineRunInputs = {
  "Legacy Users": Document;
  "Field Mapping Input": Document;
};

export async function runPipeline(inputs: PipelineRunInputs): Promise<unknown> {
  const state = {} as PipelineState;
  let spine: unknown;

  // 1. Legacy Users
  spine = await step_Legacy_Users(inputs["Legacy Users"], state);
  state["Legacy Users"] = spine as LegacyUser[];

  // 2. Human Review
  spine = await step_Human_Review(spine as LegacyUser[], state);
  state["Human Review"] = spine as LegacyUser[];

  // 3. Field Mapping Input
  spine = await step_Field_Mapping_Input(inputs["Field Mapping Input"], state);
  state["Field Mapping Input"] = spine as Document;

  // 4. Combine Inputs
  spine = await step_Combine_Inputs(spine as Document, state);
  state["Combine Inputs"] = spine as MigrationInput;

  // 5. Apply Field Mapping
  spine = await step_Apply_Field_Mapping(spine as MigrationInput, state);
  state["Apply Field Mapping"] = spine as MigratedUser[];

  // 6. Migrated Users
  spine = await step_Migrated_Users(spine as MigratedUser[], state);
  state["Migrated Users"] = spine as MigratedUser[];

  return spine;
}
