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



/*

6133: 'SOURCE_TEXT' is declared but its value is never read. 85:15 - 85:26
6133: 'SOURCE_DOC_ID' is declared but its value is never read. 86:15 - 86:28
6133: 'prompt' is declared but its value is never read. 88:33 - 88:39
6133: 'llmBatchStructured' is declared but its value is never read. 92:16 - 92:34
6133: 'resolveQuotes' is declared but its value is never read. 100:10 - 100:23
6133: 'data' is declared but its value is never read. 100:27 - 100:31
6133: 'state' is declared but its value is never read. 115:50 - 115:55
6133: 'state' is declared but its value is never read. 128:51 - 128:56
6133: 'state' is declared but its value is never read. 140:57 - 140:62
6133: 'state' is declared but its value is never read. 154:55 - 154:60
6133: 'newDoc' is declared but its value is never read. 156:9 - 156:15
6133: 'pipelineData' is declared but its value is never read. 157:9 - 157:21
6133: 'state' is declared but its value is never read. 201:57 - 201:62
2740: Type 'Document' is missing the following properties from type 'LegacyUser[]': length, pop, push, concat, and 35 more. 120:3 - 120:9
7006: Parameter 'input' implicitly has an 'any' type. 169:17 - 169:22
7006: Parameter 'v' implicitly has an 'any' type. 172:19 - 172:20
7006: Parameter 'v' implicitly has an 'any' type. 173:20 - 173:21
7006: Parameter 'v' implicitly has an 'any' type. 174:19 - 174:20
7006: Parameter 'v' implicitly has an 'any' type. 175:20 - 175:21
7006: Parameter 'v' implicitly has an 'any' type. 176:25 - 176:26
7006: Parameter 'obj' implicitly has an 'any' type. 178:22 - 178:25
7006: Parameter 'path' implicitly has an 'any' type. 178:27 - 178:31
7006: Parameter 'v' implicitly has an 'any' type. 178:33 - 178:34
7006: Parameter 'rec' implicitly has an 'any' type. 184:36 - 184:39
18046: 's' is of type 'unknown'. 187:21 - 187:22
18046: 's' is of type 'unknown'. 187:62 - 187:63
18046: 's' is of type 'unknown'. 188:51 - 188:52
18046: 's' is of type 'unknown'. 188:84 - 188:85
18046: 's' is of type 'unknown'. 188:97 - 188:98
7053: Element implicitly has an 'any' type because expression of type 'any' can't be used to index type '{ lowercase: (v: any) => string; first_word: (v: any) => string; last_word: (v: any) => string | undefined; yn_to_bool: (v: any) => boolean; ddmmyyyy_to_iso: (v: any) => string; }'. 188:111 - 188:134
18046: 's' is of type 'unknown'. 188:122 - 188:123
2554: Expected 1 arguments, but got 2. 193:22 - 193:27
2352: Conversion of type 'MigratedUser' to type 'MigratedUser[]' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Type 'MigratedUser' is missing the following properties from type 'MigratedUser[]': length, pop, push, concat, and 35 more. 203:10 - 203:33
2740: Type '{}' is missing the following properties from type 'PipelineState': "Legacy Users", "Human Review", "Field Mapping Input", "Combine Inputs", and 2 more. 208:9 - 208:14
2322: Type 'unknown' is not assignable to type 'LegacyUser[]'. 213:3 - 213:24
2345: Argument of type 'unknown' is not assignable to parameter of type 'Document'. 216:35 - 216:40
2322: Type 'unknown' is not assignable to type 'Document'. 217:3 - 217:24
2322: Type 'unknown' is not assignable to type 'Document'. 221:3 - 221:31
2345: Argument of type 'unknown' is not assignable to parameter of type 'LegacyUser'. 224:37 - 224:42
2322: Type 'unknown' is not assignable to type 'MigrationInput'. 225:3 - 225:26
2345: Argument of type 'unknown' is not assignable to parameter of type 'MigrationInput'. 228:42 - 228:47
2322: Type 'unknown' is not assignable to type 'MigratedUser[]'. 229:3 - 229:31
2345: Argument of type 'unknown' is not assignable to parameter of type 'MigratedUser'. 232:37 - 232:42
2322: Type 'unknown' is not assignable to type 'MigratedUser[]'. 233:3 - 233:26
1109: Expression expected. 158:55 - 158:56
1109: Expression expected. 158:98 - 158:99

*/