// Generated pipeline export — equivalent TypeScript representation
// Project: Legacy CRM Migration 1
// 6 steps · 10 structures · 237 lines

// === structures ===
export type Quote = { doc_id: string; start: number; end: number };
export type TextQuote = { text: string; quote: Quote };
export type Document = { content: string; filename: string };
export type FileInput = Document;
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
  "Human Review": Document;
  "Field Mapping Input": Document;
  "Combine Inputs": MigrationInput;
  "Apply Field Mapping": MigratedUser[];
  "Migrated Users": MigratedUser[];
};

// --- runtime stubs (replace with your implementations) ---
declare const SOURCE_TEXT: string;
declare const SOURCE_DOC_ID: string;

async function llmStructured<T>(prompt: string, _schema: unknown): Promise<T> {
  throw new Error("wire llmStructured to your LLM client");
}

async function llmBatchStructured<T>(
  items: unknown[],
  promptFor: (item: unknown) => string,
  schema: unknown,
): Promise<T[]> {
  return Promise.all(items.map((item) => llmStructured<T>(promptFor(item), schema)));
}

function resolveQuotes<T>(data: unknown, _sourceText: string, _docId: string): T {
  throw new Error("wire resolveQuotes to your quote linker");
}

async function waitForHumanReview<T>(_input: T): Promise<void> {
  throw new Error("wire waitForHumanReview to your review UI");
}

// === steps ===
/**
 * Legacy Users
 * @kind Input
 * JSON array of legacy user records with old field names and formats
 * @cached true
 */
async function step_Legacy_Users(input: unknown, state: PipelineState): Promise<LegacyUser[]> {
  // Parse uploaded file — built-in parser or vision OCR when enabled
  // Input guard: "JSON array of legacy user records with old field names and formats"
  // Filename must contain: "legacy_users"
  const doc = input as Document;
  return { content: doc.content, filename: doc.filename } as Document;
}

/**
 * Human Review
 * @kind Human Review
 * @cached true
 */
async function step_Human_Review(input: Document, state: PipelineState): Promise<Document> {
  // Pause for operator approval in Inference tab
  await waitForHumanReview(input);
  return input as Document;
}

/**
 * Field Mapping Input
 * @kind Input
 * JSON field-mapping spec — source columns, transforms, defaults, and target paths
 * @cached true
 */
async function step_Field_Mapping_Input(input: unknown, state: PipelineState): Promise<Document> {
  // Parse uploaded file — built-in parser or vision OCR when enabled
  // Input guard: "JSON field-mapping spec — source columns, transforms, defaults, and target paths"
  // Filename must contain: "field_mapping"
  const doc = input as Document;
  return { content: doc.content, filename: doc.filename } as Document;
}

/**
 * Combine Inputs
 * @kind Combine Inputs
 * Builds {"mapping", "legacy_users"}
 * @cached true
 */
async function step_Combine_Inputs(input: LegacyUser, state: PipelineState): Promise<MigrationInput> {
  // Merge new document input with upstream LegacyUser
  const newDoc = Array.isArray(input) ? input[0] : input;
  const pipelineData = /* upstream LegacyUser */ null;
  const merged = { mapping: /* from doc or pipeline */, legacy_users: /* from doc or pipeline */ };
  return merged as MigrationInput;
}

/**
 * Apply Field Mapping
 * @kind Custom Code
 * Driven entirely by the mapping spec: transform registry, dotted targets nest, missing source → default else null, unmapped legacy fields dropped.
 * @cached true
 */
async function step_Apply_Field_Mapping(input: MigrationInput, state: PipelineState): Promise<MigratedUser[]> {
  const __fn = (input) => {
    const spec = JSON.parse(input.mapping.content).fields;
    const transforms = {
      lowercase: (v) => String(v).toLowerCase(),
      first_word: (v) => String(v).trim().split(/\s+/)[0],
      last_word: (v) => String(v).trim().split(/\s+/).pop(),
      yn_to_bool: (v) => v === 'Y',
      ddmmyyyy_to_iso: (v) => { const [d, m, y] = String(v).split('/'); return y + '-' + m + '-' + d; }
    };
    const setPath = (obj, path, v) => {
      const keys = path.split('.');
      let cur = obj;
      for (const k of keys.slice(0, -1)) cur = cur[k] = cur[k] ?? {};
      cur[keys[keys.length - 1]] = v;
    };
    return input.legacy_users.map((rec) => {
      const out = {};
      for (const [target, s] of Object.entries(spec)) {
        const raw = s.source === undefined ? undefined : rec[s.source];
        setPath(out, target, raw === undefined ? (s.default === undefined ? null : s.default) : s.transform ? transforms[s.transform](raw) : raw);
      }
      return out;
    });
  };
  return __fn(input, state) as MigratedUser[];
}

/**
 * Migrated Users
 * @kind Output
 * @cached true
 */
async function step_Migrated_Users(input: MigratedUser, state: PipelineState): Promise<MigratedUser[]> {
  // Snapshot MigratedUser
  return input as MigratedUser[];
}

// === orchestrator ===
export async function runPipeline(initialInput: unknown): Promise<unknown> {
  const state: PipelineState = {};
  let spine = initialInput;

  // 1. Legacy Users (Input)
  spine = await step_Legacy_Users(spine, state);
  state["Legacy Users"] = spine;

  // 2. Human Review (Human Review)
  spine = await step_Human_Review(spine, state);
  state["Human Review"] = spine;

  // 3. Field Mapping Input (Input)
  spine = await step_Field_Mapping_Input(spine, state);
  state["Field Mapping Input"] = spine;

  // 4. Combine Inputs (Combine Inputs)
  spine = await step_Combine_Inputs(spine, state);
  state["Combine Inputs"] = spine;

  // 5. Apply Field Mapping (Custom Code)
  spine = await step_Apply_Field_Mapping(spine, state);
  state["Apply Field Mapping"] = spine;

  // 6. Migrated Users (Output)
  spine = await step_Migrated_Users(spine, state);
  state["Migrated Users"] = spine;

  return spine;
}
