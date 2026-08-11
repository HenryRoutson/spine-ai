// AI : Assemble / zip roadmap — staged TODOs (not implemented). Grep "TODO (assemble" to find work.
// AI : Do not stretch Combine Inputs into multi-LLM joins — Combine = new upload ⊕ one state structure;
// AI : Assemble = N computed step outputs → flat product. Keep pipeline state label-keyed and flat.

// ---------------------------------------------------------------------------
// AI : TODO (assemble-stage-A) — product assemble step (monomorphic)
// AI :   - ModuleKind.Assemble + assembleBindings: Record<field, spine | state{label}>
// AI :   - lib/assemble-type-expr.ts — resolve source TypeExpr, validate bindings vs out fields
// AI :   - validity: labelsInScope, field exists, typeExprEqual(expandNamed…)
// AI :   - execAssembleStep — build object from ctx.byLabel + spine; validateStepOutput
// AI :   - UI field→source mapper; export TS/Py/Go/Rust like combine field exprs
// AI :   - Feature: 2+ LLM calls → 2+ fields without re-emitting earlier LLM JSON
// AI :   - Feature: prefer N-way assemble over zip∘zip (one flat product from labels)
// AI :   - Non-goal: dynamic N (use llm-batch); free fork/DAG; list-of-sources Combine
// ---------------------------------------------------------------------------

// AI : TODO (assemble-stage-A-derive) — derive concrete out StructureModel from bindings
// AI :   - Like combine auto:true models: product fields = binding source TypeExprs
// AI :   - Locked auto model; optional explicit outStructureId override
// AI :   - Name e.g. Assemble_<labels>_auto — avoid nested Zip wrappers on the spine

// AI : TODO (assemble-stage-A-path) — optional path sources (defer)
// AI :   - { kind: "path", from: spine|label, path: "foo.bar" } + field-path TypeExpr
// AI :   - Do not encourage reading nested assemble outputs; prefer original step labels

// ---------------------------------------------------------------------------
// AI : TODO (assemble-stage-B) — TypeExpr assignability (still monomorphic structs)
// AI :   - typeExprAssignable(expected, actual, aliases) beyond typeExprEqual
// AI :   - optional widening, named-alias expand before compare, list cardinality rules
// AI :   - Wire into assemble validity + eventually stepAcceptsSpineType
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AI : TODO (assemble-stage-C) — parametric type aliases (shallow generics)
// AI :   - TypeAlias params?: string[]; expr may reference param names
// AI :   - Instantiation TypeExpr e.g. Pair[Summary, Entities] via expandNamedTypeExpr subst
// AI :   - Assemble outType may be structural/generic TypeExpr, not only Ref(modelId)
// AI :   - Enables derived Pair[A,B] without littering one-off auto StructureModels
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AI : TODO (assemble-stage-D) — parameterized StructureModel (real polymorphism)
// AI :   - StructureModel.params?: string[]; Ref { modelId, args?: TypeExpr[] }
// AI :   - Unify/instantiate in validity; codegen Py/TS/Rust with type params
// AI :   - Aligns with type_expr TODO — generic → generated Py/Rust, not hand Zod only
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AI : TODO (assemble-stage-E) — polymorphic step signatures in export
// AI :   - Assemble as ∀A B. (spine:A, state…) → Pair[A,B] in generated orchestrator
// AI :   - Requires stage C or D so pyright/cargo typecheck exports
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AI : TODO (assemble-parallel) — scoped parallel block (not free fork)
// AI :   - Fixed author-time branches, Promise.all inside block, auto-assemble join
// AI :   - Counterexamples: dependent branches, runtime branch count, cross-links → DAG
// AI :   - Dynamic homogeneous N stays llm-batch; do not use parallel for map/reduce
// ---------------------------------------------------------------------------

// AI : TODO (assemble-flat-state) — lint / validity: discourage nested products
// AI :   - Flag assemble bindings that read another assemble step when original labels
// AI :     are in scope — prefer re-zip from state["LLM A"] not state["Assemble"].a
// AI :   - Pipeline state remains flat StepLabel → value (see pipeline_state.ts)

export {};
