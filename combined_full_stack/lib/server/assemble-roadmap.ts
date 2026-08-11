// AI : Assemble / zip roadmap — grep "TODO (assemble" for remaining work.
// AI : Combine = new upload ⊕ one state structure; Assemble = N computed outputs → flat product.

// ---------------------------------------------------------------------------
// AI : DONE (assemble-stage-A) — ModuleKind.Assemble + bindings + validity + exec + UI + export
// AI : DONE (assemble-stage-A-derive) — auto sm_assemble_<moduleId> product from bindings
// AI : DONE (assemble-flat-state) — validity warns when binding reads another Assemble step
// AI : DONE (assemble-stage-B partial) — typeExprAssignable (alias expand + optional accepts T)
// ---------------------------------------------------------------------------

// AI : TODO (assemble-stage-A-path) — optional path sources (defer)
// AI :   - { kind: "path", from: spine|label, path: "foo.bar" } + field-path TypeExpr
// AI :   - Do not encourage reading nested assemble outputs; prefer original step labels

// AI : TODO (assemble-stage-B) — richer assignability (list covariance, union members)
// AI :   - Wire more rules into typeExprAssignable + stepAcceptsSpineType

// AI : TODO (assemble-stage-C) — parametric type aliases (shallow generics)
// AI :   - TypeAlias params?: string[]; Pair[Summary, Entities] via expandNamedTypeExpr subst
// AI :   - Assemble outType may be structural/generic TypeExpr, not only Ref(modelId)

// AI : TODO (assemble-stage-D) — parameterized StructureModel (real polymorphism)
// AI :   - StructureModel.params?: string[]; Ref { modelId, args?: TypeExpr[] }

// AI : TODO (assemble-stage-E) — polymorphic Assemble signatures in export (needs C/D)

// AI : TODO (assemble-parallel) — scoped parallel block (not free fork)
// AI :   - Fixed author-time branches, Promise.all inside block, auto-assemble join

export {};
