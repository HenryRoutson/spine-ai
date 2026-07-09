(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/lib/run-metrics.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "finalizeRunMetrics",
    ()=>finalizeRunMetrics,
    "runBilledCents",
    ()=>runBilledCents,
    "runSavedCents",
    ()=>runSavedCents,
    "runTotalMs",
    ()=>runTotalMs
]);
function sumStepMs(steps) {
    return steps.reduce((a, s)=>a + (s.ms ?? 0), 0);
}
function sumLlmLatencyMs(steps) {
    return steps.reduce((a, s)=>{
        const calls = [
            ...s.llmCalls ?? [],
            ...s.descriptionCheckLlmCalls ?? []
        ];
        return a + calls.reduce((b, c)=>b + (c.latencyMs ?? 0), 0);
    }, 0);
}
function sumStepBilledCents(steps) {
    return +steps.reduce((a, s)=>a + (s.costCents ?? 0), 0).toFixed(4);
}
function sumStepSavedCents(steps) {
    return +steps.reduce((a, s)=>a + (s.savedCostCents ?? 0), 0).toFixed(4);
}
function runTotalMs(run) {
    const stored = Number.isFinite(run.totalMs) ? run.totalMs : 0;
    if (stored > 0) return stored;
    const fromSteps = sumStepMs(run.steps);
    if (fromSteps > 0) return fromSteps;
    return sumLlmLatencyMs(run.steps);
}
function runBilledCents(run) {
    const stored = Number.isFinite(run.billedCents) ? run.billedCents : 0;
    if (stored > 0) return stored;
    return sumStepBilledCents(run.steps);
}
function runSavedCents(run) {
    const stored = Number.isFinite(run.savedCents) ? run.savedCents : 0;
    if (stored > 0) return stored;
    return sumStepSavedCents(run.steps);
}
function finalizeRunMetrics(steps, startedAt) {
    const stepMs = sumStepMs(steps);
    const wallMs = Math.max(0, Date.now() - startedAt);
    return {
        totalMs: Math.max(stepMs, wallMs),
        billedCents: sumStepBilledCents(steps)
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/server/billing.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "billingFromRuns",
    ()=>billingFromRuns,
    "billingPointsUsd",
    ()=>billingPointsUsd,
    "billingSeries",
    ()=>billingSeries,
    "moduleMetrics",
    ()=>moduleMetrics,
    "totalSaved",
    ()=>totalSaved,
    "totalUsageFromRuns",
    ()=>totalUsageFromRuns
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$run$2d$metrics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/run-metrics.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$model_catalog$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/model_catalog.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/types.ts [app-client] (ecmascript) <locals>");
;
;
;
function dayOf(ts) {
    return new Date(ts).toLocaleString("en-US", {
        month: "short",
        day: "2-digit"
    });
}
function billingFromRuns(runs) {
    // AI : bug fix — sorting parsed "Jun 11" labels breaks across a year boundary;
    // AI : track the earliest real timestamp per day and sort on that instead.
    const byDay = new Map();
    for (const run of runs){
        const day = dayOf(run.startedAt);
        const bucket = byDay.get(day) ?? {
            ts: run.startedAt,
            spend: {}
        };
        bucket.ts = Math.min(bucket.ts, run.startedAt);
        for (const step of run.steps){
            if (step.costCents <= 0) continue;
            const key = run.source === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["RunSource"].Assistant ? "Agent" : run.source === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["RunSource"].SharedLink ? "shared link" : step.kind === "doc-to-text" && !step.model ? "doc-parse svc" : (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$model_catalog$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["catalogLabel"])(step.model ?? run.model);
            bucket.spend[key] = +((bucket.spend[key] ?? 0) + step.costCents).toFixed(4);
        }
        byDay.set(day, bucket);
    }
    return [
        ...byDay.entries()
    ].sort((a, b)=>a[1].ts - b[1].ts).map(([day, { spend }])=>({
            day,
            ...spend
        }));
}
function totalSaved(runs) {
    return +runs.reduce((a, r)=>a + r.savedCents, 0).toFixed(4);
}
function totalUsageFromRuns(runs) {
    return +runs.reduce((a, r)=>a + (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$run$2d$metrics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["runBilledCents"])(r), 0).toFixed(4);
}
function billingSeries(runs) {
    return billingFromRuns(runs);
}
function billingPointsUsd(points) {
    return points.map((point)=>{
        const out = {
            day: point.day
        };
        for (const [k, v] of Object.entries(point)){
            if (k === "day") continue;
            out[k] = +(Number(v) / 100).toFixed(4);
        }
        return out;
    });
}
function moduleMetrics(runs) {
    const agg = new Map();
    for (const r of runs){
        for (const s of r.steps){
            // AI : skip cached/error steps — only count real executions (status ok).
            if (s.status !== "ok") continue;
            const cur = agg.get(s.moduleId) ?? {
                ms: 0,
                cents: 0,
                n: 0
            };
            agg.set(s.moduleId, {
                ms: cur.ms + s.ms,
                cents: cur.cents + s.costCents,
                n: cur.n + 1
            });
        }
    }
    const out = new Map();
    for (const [id, v] of agg)out.set(id, {
        avgMs: Math.round(v.ms / v.n),
        avgCostCents: +(v.cents / v.n).toFixed(2)
    });
    return out;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/billing.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
// AI : pure aggregation over PipelineRun[] — Billing/Pipeline tabs compute from the runs
// AI : the store already fetched instead of asking the server again.
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$billing$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/billing.ts [app-client] (ecmascript)");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/pipeline-layout.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "blocksInsertBefore",
    ()=>blocksInsertBefore,
    "combineGroupAt",
    ()=>combineGroupAt,
    "combinePairIds",
    ()=>combinePairIds,
    "insertAfterIndex",
    ()=>insertAfterIndex,
    "insertBeforeIndex",
    ()=>insertBeforeIndex,
    "managedPipelinePairIds",
    ()=>managedPipelinePairIds,
    "mergeCombineSegmentStatus",
    ()=>mergeCombineSegmentStatus,
    "modulesInSegment",
    ()=>modulesInSegment,
    "pairedCombineInputModule",
    ()=>pairedCombineInputModule,
    "segmentPipeline",
    ()=>segmentPipeline
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$kinds$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/module-kinds.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$quote$2d$steps$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/quote-steps.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/validity-sync.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$parse$2d$steps$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/structure-parse-steps.ts [app-client] (ecmascript) <locals>");
;
;
;
;
function combineGroupAt(modules, i) {
    if (modules[i]?.kind !== "combine") return undefined;
    const prev = modules[i - 1];
    if (prev?.kind === "input") return {
        input: prev
    };
    if (prev && (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isAutoStructureParseStep"])(prev) && modules[i - 2]?.kind === "input") {
        return {
            input: modules[i - 2],
            parse: prev
        };
    }
    return undefined;
}
function segmentPipeline(modules) {
    const inGroup = new Set();
    for(let i = 0; i < modules.length; i++){
        const g = combineGroupAt(modules, i);
        if (g) {
            inGroup.add(g.input.id);
            if (g.parse) inGroup.add(g.parse.id);
        }
    }
    const segments = [];
    for(let i = 0; i < modules.length; i++){
        const m = modules[i];
        const g = combineGroupAt(modules, i);
        if (g) {
            segments.push({
                kind: "combine",
                combine: m,
                input: g.input,
                parse: g.parse,
                index: i
            });
        } else if (!inGroup.has(m.id)) {
            segments.push({
                kind: "step",
                module: m,
                index: i
            });
        }
    }
    return segments;
}
function combinePairIds(modules, id) {
    const i = modules.findIndex((m)=>m.id === id);
    if (i < 0) return [
        id
    ];
    for(let c = i; c <= i + 2 && c < modules.length; c++){
        const g = combineGroupAt(modules, c);
        if (!g) continue;
        const ids = [
            g.input.id,
            ...g.parse ? [
                g.parse.id
            ] : [],
            modules[c].id
        ];
        if (ids.includes(id)) return ids;
    }
    return [
        id
    ];
}
function insertBeforeIndex(seg) {
    return seg.kind === "combine" ? seg.index - (seg.parse ? 2 : 1) : seg.index;
}
function insertAfterIndex(seg) {
    return seg.index + 1;
}
function modulesInSegment(seg) {
    if (seg.kind === "combine") return [
        seg.input,
        ...seg.parse ? [
            seg.parse
        ] : [],
        seg.combine
    ];
    return [
        seg.module
    ];
}
function pairedCombineInputModule(combine, modules) {
    const i = modules.findIndex((m)=>m.id === combine.id);
    if (combine.kind !== "combine" || i <= 0) return undefined;
    return combineGroupAt(modules, i)?.input;
}
function blocksInsertBefore(modules, insertAt) {
    if (insertAt <= 0 || insertAt >= modules.length) return false;
    const prev = modules[insertAt - 1];
    const next = modules[insertAt];
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$kinds$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isLlmKind"])(prev.kind) && (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isAutoQuoteStep"])(next) || prev.kind === "input" && (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isAutoStructureParseStep"])(next);
}
function managedPipelinePairIds(modules, id) {
    const group = combinePairIds(modules, id);
    if (group.length > 1) return group;
    const i = modules.findIndex((m)=>m.id === id);
    if (i < 0) return [
        id
    ];
    const m = modules[i];
    if (m.kind === "input") {
        const next = modules[i + 1];
        if (next && (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isAutoStructureParseStep"])(next)) return [
            m.id,
            next.id
        ];
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isAutoStructureParseStep"])(m)) {
        const prev = modules[i - 1];
        if (prev?.kind === "input") return [
            prev.id,
            m.id
        ];
    }
    return [
        id
    ];
}
function mergeCombineSegmentStatus(combineStatus, inputStatus) {
    if (combineStatus === "error" || inputStatus === "error") return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["RunStepStatus"].Error;
    if (combineStatus === "running" || inputStatus === "running") return "running";
    if (combineStatus === "cached" || inputStatus === "cached") return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["RunStepStatus"].Cached;
    if (combineStatus !== "idle" || inputStatus !== "idle") return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["RunStepStatus"].Ok;
    return "idle";
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/module-ui.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AutoQuoteLock",
    ()=>AutoQuoteLock,
    "AutoStructureParseLock",
    ()=>AutoStructureParseLock,
    "BatchSparkleIcon",
    ()=>BatchSparkleIcon,
    "KIND_COLOR",
    ()=>KIND_COLOR,
    "KIND_ICON",
    ()=>KIND_ICON,
    "KindIcon",
    ()=>KindIcon,
    "PipelineConnector",
    ()=>PipelineConnector,
    "PipelineNode",
    ()=>PipelineNode,
    "stepKindIcon",
    ()=>stepKindIcon
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$input$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileInput$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/file-input.mjs [app-client] (ecmascript) <export default as FileInput>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$output$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileOutput$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/file-output.mjs [app-client] (ecmascript) <export default as FileOutput>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/file-text.mjs [app-client] (ecmascript) <export default as FileText>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$merge$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Merge$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/merge.mjs [app-client] (ecmascript) <export default as Merge>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shuffle$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Shuffle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/shuffle.mjs [app-client] (ecmascript) <export default as Shuffle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkle$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sparkle.mjs [app-client] (ecmascript) <export default as Sparkle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$code$2d$xml$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Code2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/code-xml.mjs [app-client] (ecmascript) <export default as Code2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$link$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Link2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/link-2.mjs [app-client] (ecmascript) <export default as Link2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/lock.mjs [app-client] (ecmascript) <export default as Lock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$check$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldCheck$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/shield-check.mjs [app-client] (ecmascript) <export default as ShieldCheck>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2d$check$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__UserCheck$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/user-check.mjs [app-client] (ecmascript) <export default as UserCheck>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/types.ts [app-client] (ecmascript) <locals>");
"use client";
;
;
;
;
function BatchSparkleIcon({ className }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("inline-grid grid-cols-2 gap-px leading-none [&_svg]:size-[42%]", className),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkle$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkle$3e$__["Sparkle"], {}, void 0, false, {
                fileName: "[project]/lib/module-ui.tsx",
                lineNumber: 29,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkle$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkle$3e$__["Sparkle"], {}, void 0, false, {
                fileName: "[project]/lib/module-ui.tsx",
                lineNumber: 30,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkle$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkle$3e$__["Sparkle"], {}, void 0, false, {
                fileName: "[project]/lib/module-ui.tsx",
                lineNumber: 31,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkle$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkle$3e$__["Sparkle"], {}, void 0, false, {
                fileName: "[project]/lib/module-ui.tsx",
                lineNumber: 32,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/lib/module-ui.tsx",
        lineNumber: 23,
        columnNumber: 5
    }, this);
}
_c = BatchSparkleIcon;
const KIND_ICON = {
    input: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$input$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileInput$3e$__["FileInput"],
    llm: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkle$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkle$3e$__["Sparkle"],
    "llm-batch": BatchSparkleIcon,
    quote: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$link$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Link2$3e$__["Link2"],
    transform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shuffle$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Shuffle$3e$__["Shuffle"],
    combine: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$merge$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Merge$3e$__["Merge"],
    "custom-code": __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$code$2d$xml$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Code2$3e$__["Code2"],
    assert: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$check$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldCheck$3e$__["ShieldCheck"],
    "human-review": __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2d$check$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__UserCheck$3e$__["UserCheck"],
    output: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$output$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileOutput$3e$__["FileOutput"]
};
const KIND_COLOR = {
    input: "text-chart-2",
    llm: "text-primary",
    "llm-batch": "text-primary",
    quote: "text-chart-2",
    transform: "text-chart-3",
    combine: "text-chart-3",
    "custom-code": "text-chart-1",
    assert: "text-chart-2",
    "human-review": "text-chart-1",
    output: "text-output"
};
const LEGACY_KIND_ICON = {
    "doc-to-text": __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"]
};
function stepKindIcon(kind) {
    return KIND_ICON[kind] ?? LEGACY_KIND_ICON[kind] ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$input$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileInput$3e$__["FileInput"];
}
function KindIcon({ kind, size = "md" }) {
    const Icon = KIND_ICON[kind];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex w-14 shrink-0 flex-col items-center gap-0.5",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Icon, {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4", KIND_COLOR[kind])
            }, void 0, false, {
                fileName: "[project]/lib/module-ui.tsx",
                lineNumber: 77,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-center text-[8px] leading-tight text-muted-foreground",
                children: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["MODULE_META"][kind].label
            }, void 0, false, {
                fileName: "[project]/lib/module-ui.tsx",
                lineNumber: 78,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/lib/module-ui.tsx",
        lineNumber: 76,
        columnNumber: 5
    }, this);
}
_c1 = KindIcon;
function PipelineNode({ label, subtle }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider", subtle ? "border-border text-muted-foreground" : "border-primary text-primary"),
        children: label
    }, void 0, false, {
        fileName: "[project]/lib/module-ui.tsx",
        lineNumber: 87,
        columnNumber: 5
    }, this);
}
_c2 = PipelineNode;
function PipelineConnector({ invalid }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex h-8 w-full items-center justify-center",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("h-full w-px", invalid ? "bg-destructive" : "bg-border")
        }, void 0, false, {
            fileName: "[project]/lib/module-ui.tsx",
            lineNumber: 101,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/lib/module-ui.tsx",
        lineNumber: 100,
        columnNumber: 5
    }, this);
}
_c3 = PipelineConnector;
function AutoQuoteLock({ className }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("inline-flex shrink-0 items-center gap-1 rounded-md border border-chart-2/40 bg-chart-2/10 px-1.5 py-0.5 text-chart-2", className),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__["Lock"], {
                className: "h-3 w-3"
            }, void 0, false, {
                fileName: "[project]/lib/module-ui.tsx",
                lineNumber: 114,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "font-mono text-[9px]",
                children: "auto"
            }, void 0, false, {
                fileName: "[project]/lib/module-ui.tsx",
                lineNumber: 115,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/lib/module-ui.tsx",
        lineNumber: 108,
        columnNumber: 5
    }, this);
}
_c4 = AutoQuoteLock;
function AutoStructureParseLock({ className }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("inline-flex shrink-0 items-center gap-1 rounded-md border border-chart-3/40 bg-chart-3/10 px-1.5 py-0.5 text-chart-3", className),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__["Lock"], {
                className: "h-3 w-3"
            }, void 0, false, {
                fileName: "[project]/lib/module-ui.tsx",
                lineNumber: 128,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "font-mono text-[9px]",
                children: "auto"
            }, void 0, false, {
                fileName: "[project]/lib/module-ui.tsx",
                lineNumber: 129,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/lib/module-ui.tsx",
        lineNumber: 122,
        columnNumber: 5
    }, this);
}
_c5 = AutoStructureParseLock;
var _c, _c1, _c2, _c3, _c4, _c5;
__turbopack_context__.k.register(_c, "BatchSparkleIcon");
__turbopack_context__.k.register(_c1, "KindIcon");
__turbopack_context__.k.register(_c2, "PipelineNode");
__turbopack_context__.k.register(_c3, "PipelineConnector");
__turbopack_context__.k.register(_c4, "AutoQuoteLock");
__turbopack_context__.k.register(_c5, "AutoStructureParseLock");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/window-header.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "WindowHeader",
    ()=>WindowHeader
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
;
function WindowHeader({ step, title, description, actions }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-start justify-between gap-4 border-b border-border px-5 py-3.5",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "min-w-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-mono text-[11px] text-primary",
                                children: step
                            }, void 0, false, {
                                fileName: "[project]/components/window-header.tsx",
                                lineNumber: 18,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "text-sm font-semibold tracking-tight",
                                children: title
                            }, void 0, false, {
                                fileName: "[project]/components/window-header.tsx",
                                lineNumber: 19,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/window-header.tsx",
                        lineNumber: 17,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-0.5 truncate text-xs text-muted-foreground",
                        children: description
                    }, void 0, false, {
                        fileName: "[project]/components/window-header.tsx",
                        lineNumber: 21,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/window-header.tsx",
                lineNumber: 16,
                columnNumber: 7
            }, this),
            actions ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex shrink-0 items-center gap-2",
                children: actions
            }, void 0, false, {
                fileName: "[project]/components/window-header.tsx",
                lineNumber: 25,
                columnNumber: 18
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/components/window-header.tsx",
        lineNumber: 15,
        columnNumber: 5
    }, this);
}
_c = WindowHeader;
var _c;
__turbopack_context__.k.register(_c, "WindowHeader");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/ui-classes.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// AI : shared Tailwind class tokens.
__turbopack_context__.s([
    "WARNING_TEXT_CLASS",
    ()=>WARNING_TEXT_CLASS
]);
const WARNING_TEXT_CLASS = "text-amber-600 dark:text-amber-500";
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/color-scheme.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "COLOR_SCHEMES",
    ()=>COLOR_SCHEMES,
    "COLOR_SCHEME_CHANGED_EVENT",
    ()=>COLOR_SCHEME_CHANGED_EVENT,
    "COLOR_SCHEME_IDS",
    ()=>COLOR_SCHEME_IDS,
    "DEFAULT_COLOR_SCHEME",
    ()=>DEFAULT_COLOR_SCHEME,
    "applyColorSchemeAttribute",
    ()=>applyColorSchemeAttribute,
    "readColorScheme",
    ()=>readColorScheme,
    "readStatusPalette",
    ()=>readStatusPalette,
    "useStatusPalette",
    ()=>useStatusPalette,
    "writeColorScheme",
    ()=>writeColorScheme
]);
// AI : color scheme preferences for accessibility — covers the three main types of colour blindness.
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$browser$2d$storage$2d$pref$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/browser-storage-pref.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$use$2d$browser$2d$pref$2d$event$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/use-browser-pref-event.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
;
// AI : stat and axis are identical across schemes — they're neutral, not status-bearing.
const NEUTRAL = {
    stat: "#94a3b8",
    axis: "#64748b"
};
const COLOR_SCHEMES = {
    default: {
        label: "Default",
        description: "Green = ok, red = error, amber = retry.",
        palette: {
            ok: "#22c55e",
            okStroke: "#15803d",
            okText: "text-[#22c55e]",
            err: "#ef4444",
            errStroke: "#b91c1c",
            errText: "text-[#ef4444]",
            retry: "#f59e0b",
            retryStroke: "#b45309",
            retryText: "text-[#f59e0b]",
            ...NEUTRAL
        }
    },
    deuteranopia: {
        label: "Deuteranopia / Protanopia",
        description: "Blue = ok, orange = error, violet = retry. For red-green colour blindness.",
        palette: {
            ok: "#3b82f6",
            okStroke: "#1d4ed8",
            okText: "text-[#3b82f6]",
            err: "#f97316",
            errStroke: "#c2410c",
            errText: "text-[#f97316]",
            retry: "#a855f7",
            retryStroke: "#7e22ce",
            retryText: "text-[#a855f7]",
            ...NEUTRAL
        }
    },
    tritanopia: {
        label: "Tritanopia",
        description: "Teal = ok, magenta = error, amber = retry. For blue-yellow colour blindness.",
        palette: {
            ok: "#0891b2",
            okStroke: "#0e7490",
            okText: "text-[#0891b2]",
            err: "#db2777",
            errStroke: "#9d174d",
            errText: "text-[#db2777]",
            retry: "#f59e0b",
            retryStroke: "#b45309",
            retryText: "text-[#f59e0b]",
            ...NEUTRAL
        }
    }
};
const COLOR_SCHEME_IDS = [
    "default",
    "deuteranopia",
    "tritanopia"
];
const COLOR_SCHEME_CHANGED_EVENT = "color-scheme-changed";
const DEFAULT_COLOR_SCHEME = "default";
const colorSchemePref = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$browser$2d$storage$2d$pref$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["stringBrowserPref"])({
    keySuffix: "color-scheme",
    defaultValue: DEFAULT_COLOR_SCHEME,
    changedEvent: COLOR_SCHEME_CHANGED_EVENT,
    isValid: (v)=>COLOR_SCHEME_IDS.includes(v)
});
const readColorScheme = colorSchemePref.read;
function writeColorScheme(scheme) {
    colorSchemePref.write(scheme);
    if (typeof document !== "undefined") {
        document.documentElement.dataset.colorScheme = scheme === DEFAULT_COLOR_SCHEME ? "" : scheme;
    }
}
function applyColorSchemeAttribute() {
    if (typeof document === "undefined") return;
    const scheme = readColorScheme();
    if (scheme !== DEFAULT_COLOR_SCHEME) {
        document.documentElement.dataset.colorScheme = scheme;
    }
}
function readStatusPalette() {
    return COLOR_SCHEMES[readColorScheme()].palette;
}
function useStatusPalette() {
    _s();
    const schemeId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$use$2d$browser$2d$pref$2d$event$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useBrowserPrefEvent"])(COLOR_SCHEME_CHANGED_EVENT, readColorScheme);
    return COLOR_SCHEMES[schemeId].palette;
}
_s(useStatusPalette, "y41jbPeOtRKwfhKpY/qnf34aubU=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$use$2d$browser$2d$pref$2d$event$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useBrowserPrefEvent"]
    ];
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/chart-colors.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CHART_AXIS",
    ()=>CHART_AXIS,
    "CHART_STAT",
    ()=>CHART_STAT
]);
// AI : shared SVG / inline status colors for profiling and distribution charts.
// Status colors (ok/err/retry) now come from the user-selected color scheme — import useStatusPalette() instead.
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$color$2d$scheme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/color-scheme.ts [app-client] (ecmascript)");
;
const CHART_STAT = "#94a3b8";
const CHART_AXIS = "#64748b";
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/structure-link.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "StructureLink",
    ()=>StructureLink
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$shell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/app-shell.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$validity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/validity.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/validity-types.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
function StructureLink({ models, structureId, fallback = "·", className }) {
    _s();
    const { openStructure } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$shell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAppShell"])();
    const name = structureId ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["modelName"])(models, structureId) : undefined;
    const label = name ?? fallback;
    if (!structureId || !name) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: className,
            children: label
        }, void 0, false, {
            fileName: "[project]/components/structure-link.tsx",
            lineNumber: 25,
            columnNumber: 12
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        role: "link",
        tabIndex: 0,
        onClick: (e)=>{
            e.stopPropagation();
            openStructure(structureId);
        },
        onKeyDown: (e)=>{
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            e.stopPropagation();
            openStructure(structureId);
        },
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("cursor-pointer text-primary underline-offset-2 hover:underline", className),
        title: `Open ${name} in Structure tab`,
        children: label
    }, void 0, false, {
        fileName: "[project]/components/structure-link.tsx",
        lineNumber: 29,
        columnNumber: 5
    }, this);
}
_s(StructureLink, "4+3yijfSaAAOgtcPy3XMbGfstx8=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$shell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAppShell"]
    ];
});
_c = StructureLink;
var _c;
__turbopack_context__.k.register(_c, "StructureLink");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/pipeline-canvas.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PipelineCanvas",
    ()=>PipelineCanvas,
    "PipelineCanvasConnector",
    ()=>PipelineCanvasConnector,
    "PipelineCanvasEnd",
    ()=>PipelineCanvasEnd,
    "PipelineCanvasSegment",
    ()=>PipelineCanvasSegment,
    "PipelineCanvasStart",
    ()=>PipelineCanvasStart
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// AI : TODO refactor (spec) — remove combine segments when implicit multi-input merge ships (pipeline-layout.ts).
// AI : TODO (spec) — execution-order view maximizing parallel llm-batch; dependency arrows from step() label refs.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$right$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowRight$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-right.mjs [app-client] (ecmascript) <export default as ArrowRight>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$right$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronRight$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-right.mjs [app-client] (ecmascript) <export default as ChevronRight>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/triangle-alert.mjs [app-client] (ecmascript) <export default as AlertTriangle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/zap.mjs [app-client] (ecmascript) <export default as Zap>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pipeline$2d$layout$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/pipeline-layout.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$quote$2d$steps$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/quote-steps.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/validity-sync.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$parse$2d$steps$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/structure-parse-steps.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/module-ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/inference-input.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/inference-input-core.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$validity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/validity.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$messages$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/validity-messages.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$inspect$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/validity-inspect.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/validity-types.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ui$2d$classes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/ui-classes.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/chart-colors.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$color$2d$scheme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/color-scheme.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/badge.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/structure-link.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
;
;
;
;
function PipelineCanvas({ modules, models, selectedId, onSelect, stepStatus, testCoverage, invalid, warnings, renderInsertBefore, renderInsertAfter, renderBeforeEnd, renderFooter, className }) {
    const segments = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pipeline$2d$layout$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["segmentPipeline"])(modules);
    const editMode = Boolean(renderInsertAfter ?? renderInsertBefore ?? renderFooter);
    const firstSeg = segments[0];
    const startConnectionInvalid = firstSeg ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$inspect$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ioMismatchAtModuleIndex"])(modules, invalid, firstSeg.index) : false;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("mx-auto flex w-full max-w-xl flex-col items-stretch gap-0", className),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mx-auto flex w-full flex-col items-center",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineNode"], {
                        label: "Start",
                        subtle: true
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-canvas.tsx",
                        lineNumber: 89,
                        columnNumber: 9
                    }, this),
                    segments.length > 0 && renderInsertBefore?.((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pipeline$2d$layout$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["insertBeforeIndex"])(segments[0])),
                    segments.length > 0 && !renderInsertBefore && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineConnector"], {
                        invalid: startConnectionInvalid
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-canvas.tsx",
                        lineNumber: 91,
                        columnNumber: 56
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/pipeline-canvas.tsx",
                lineNumber: 88,
                columnNumber: 7
            }, this),
            segments.map((seg)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SegmentRow, {
                    seg: seg,
                    modules: modules,
                    models: models,
                    selectedId: selectedId,
                    onSelect: onSelect,
                    stepStatus: stepStatus,
                    testCoverage: testCoverage,
                    invalid: invalid,
                    warnings: warnings,
                    editMode: editMode,
                    renderInsertAfter: renderInsertAfter
                }, seg.kind === "combine" ? seg.combine.id : seg.module.id, false, {
                    fileName: "[project]/components/pipeline-canvas.tsx",
                    lineNumber: 94,
                    columnNumber: 9
                }, this)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mx-auto flex w-full flex-col items-center",
                children: [
                    renderBeforeEnd?.(),
                    segments.length === 0 && renderInsertAfter?.(0, {}),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineNode"], {
                        label: "End",
                        subtle: true
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-canvas.tsx",
                        lineNumber: 112,
                        columnNumber: 9
                    }, this),
                    renderFooter?.()
                ]
            }, void 0, true, {
                fileName: "[project]/components/pipeline-canvas.tsx",
                lineNumber: 109,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/pipeline-canvas.tsx",
        lineNumber: 87,
        columnNumber: 5
    }, this);
}
_c = PipelineCanvas;
function SegmentRow({ seg, modules, models, selectedId, onSelect, stepStatus, testCoverage, invalid, warnings, editMode, renderInsertAfter }) {
    const insertAt = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pipeline$2d$layout$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["insertAfterIndex"])(seg);
    const blocked = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pipeline$2d$layout$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["blocksInsertBefore"])(modules, insertAt);
    const connectionInvalid = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$inspect$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ioMismatchAtModuleIndex"])(modules, invalid, insertAt);
    if (seg.kind === "combine") {
        const { combine, input, parse, index } = seg;
        const combineIssue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["invalidForModule"])(invalid ?? new Map(), combine.id);
        const combineInvalid = combineIssue && combineIssue.kind !== "io-mismatch" && combineIssue.kind !== "cardinality-mismatch";
        const combineIoLinked = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$inspect$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["stepIoMismatchLinked"])(combine.id, modules, invalid);
        const combineIoMsg = combineIoLinked && invalid ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$inspect$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["stepIoMismatchMessage"])(combine.id, modules, invalid, models) : undefined;
        const combineStatus = stepStatus?.get(combine.id);
        const inputStatus = stepStatus?.get(input.id);
        const parseStatus = parse ? stepStatus?.get(parse.id) : undefined;
        const combineCoverage = testCoverage?.get(combine.id);
        const inputCoverage = testCoverage?.get(input.id);
        const groupSelected = selectedId === combine.id || selectedId === input.id || selectedId === parse?.id;
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "mx-auto flex w-full flex-col items-center",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("w-full rounded-lg border-2 border-dashed px-3.5 py-3 transition-colors", combineInvalid ? "border-destructive/70 bg-destructive/5" : combineIoLinked ? "border-destructive/60 bg-destructive/[0.03]" : testCoverageBorder(combineCoverage, selectedId === combine.id) ?? statusBorder(combineStatus) ?? (groupSelected ? "border-primary bg-primary/5" : "border-chart-3/40 bg-chart-3/5")),
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepButton, {
                            onClick: ()=>onSelect?.(combine.id),
                            className: "flex w-full items-start gap-2 text-left",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepIndex, {
                                    index: index
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 179,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["KindIcon"], {
                                    kind: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ModuleKind"].Combine
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 180,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepBody, {
                                    label: combine.label,
                                    detail: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                                                models: models,
                                                structureId: combine.inStructureId,
                                                fallback: "pipeline"
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-canvas.tsx",
                                                lineNumber: 185,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-muted-foreground/60",
                                                children: " + "
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-canvas.tsx",
                                                lineNumber: 186,
                                                columnNumber: 19
                                            }, this),
                                            parse ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                                                models: models,
                                                structureId: parse.outStructureId
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-canvas.tsx",
                                                lineNumber: 188,
                                                columnNumber: 21
                                            }, this) : "document",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-muted-foreground/60",
                                                children: " → "
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-canvas.tsx",
                                                lineNumber: 192,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                                                models: models,
                                                structureId: combine.outStructureId
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-canvas.tsx",
                                                lineNumber: 193,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true)
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 181,
                                    columnNumber: 13
                                }, this),
                                combine.cached && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__["Zap"], {
                                    className: "h-3.5 w-3.5 shrink-0 text-primary"
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 197,
                                    columnNumber: 32
                                }, this),
                                combineCoverage && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TestCoverageBadge, {
                                    status: combineCoverage
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 198,
                                    columnNumber: 33
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepTrailingIcon, {
                                    invalid: combineInvalid || combineIoLinked,
                                    status: combineStatus,
                                    editMode: editMode
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 199,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/pipeline-canvas.tsx",
                            lineNumber: 178,
                            columnNumber: 11
                        }, this),
                        combine.note && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "mt-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground",
                            children: combine.note
                        }, void 0, false, {
                            fileName: "[project]/components/pipeline-canvas.tsx",
                            lineNumber: 206,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepButton, {
                            onClick: ()=>onSelect?.(input.id),
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("mt-2 flex w-full items-start gap-3 rounded-md border bg-card px-3 py-2.5 text-left transition-colors", selectedId === input.id ? "border-primary" : testCoverageBorder(inputCoverage, selectedId === input.id) ?? statusBorder(inputStatus) ?? "border-border hover:border-muted-foreground/40"),
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["KindIcon"], {
                                    kind: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ModuleKind"].Input,
                                    size: "sm"
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 219,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepBody, {
                                    label: input.label,
                                    labelClass: "text-xs",
                                    detail: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                                                models: models,
                                                structureId: input.outStructureId
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-canvas.tsx",
                                                lineNumber: 225,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-muted-foreground/60",
                                                children: " · "
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-canvas.tsx",
                                                lineNumber: 226,
                                                columnNumber: 19
                                            }, this),
                                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["inputTypeLabel"])(input.inputType)
                                        ]
                                    }, void 0, true)
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 220,
                                    columnNumber: 13
                                }, this),
                                inputCoverage && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TestCoverageBadge, {
                                    status: inputCoverage
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 231,
                                    columnNumber: 31
                                }, this),
                                !editMode && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RunStatusIcon, {
                                    status: inputStatus
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 232,
                                    columnNumber: 27
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/pipeline-canvas.tsx",
                            lineNumber: 208,
                            columnNumber: 11
                        }, this),
                        parse && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepButton, {
                            onClick: ()=>onSelect?.(parse.id),
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("mt-2 flex w-full items-start gap-3 rounded-md border border-dashed border-chart-3/50 bg-chart-3/5 px-3 py-2.5 text-left transition-colors", selectedId === parse.id ? "border-primary" : statusBorder(parseStatus) ?? "hover:border-chart-3"),
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["KindIcon"], {
                                    kind: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ModuleKind"].Llm,
                                    size: "sm"
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 245,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepBody, {
                                    label: parse.label,
                                    labelClass: "text-xs",
                                    detail: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                                                models: models,
                                                structureId: parse.inStructureId
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-canvas.tsx",
                                                lineNumber: 251,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-muted-foreground/60",
                                                children: " → "
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-canvas.tsx",
                                                lineNumber: 252,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                                                models: models,
                                                structureId: parse.outStructureId
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-canvas.tsx",
                                                lineNumber: 253,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true)
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 246,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AutoStructureParseLock"], {}, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 257,
                                    columnNumber: 15
                                }, this),
                                !editMode && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RunStatusIcon, {
                                    status: parseStatus
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 258,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/pipeline-canvas.tsx",
                            lineNumber: 236,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/pipeline-canvas.tsx",
                    lineNumber: 165,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(InvalidMessage, {
                    show: !!combineInvalid || !!combineIoMsg,
                    message: combineInvalid ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$messages$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["invalidStepMessage"])(combineIssue, models, modules) : combineIoMsg
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-canvas.tsx",
                    lineNumber: 262,
                    columnNumber: 9
                }, this),
                renderInsertAfter?.(insertAt, {
                    blocked,
                    connectionInvalid
                }) ?? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineConnector"], {
                    invalid: connectionInvalid
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-canvas.tsx",
                    lineNumber: 271,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/pipeline-canvas.tsx",
            lineNumber: 164,
            columnNumber: 7
        }, this);
    }
    const m = seg.module;
    const i = seg.index;
    const stepIssue = invalid ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["invalidForModule"])(invalid, m.id) : undefined;
    const isInvalid = !!stepIssue && stepIssue.kind !== "io-mismatch" && stepIssue.kind !== "cardinality-mismatch";
    const ioLinked = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$inspect$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["stepIoMismatchLinked"])(m.id, modules, invalid);
    const stepWarnings = warnings?.get(m.id);
    const autoQuote = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isAutoQuoteStep"])(m);
    const autoStruct = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isAutoStructureParseStep"])(m);
    const locked = autoQuote || autoStruct;
    const status = stepStatus?.get(m.id);
    const coverage = testCoverage?.get(m.id);
    if (m.kind === "output") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "mx-auto flex w-full flex-col items-center",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex w-full items-center justify-center",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "relative w-full max-w-xs",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepButton, {
                                onClick: ()=>onSelect?.(m.id),
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-3 text-center transition-colors", "border-output/50 bg-output/5 shadow-sm", isInvalid && "border-destructive/70 bg-destructive/5", !isInvalid && ioLinked && "border-destructive/60 bg-destructive/[0.03]", testCoverageBorder(coverage, m.id === selectedId), statusBorder(status), m.id === selectedId && "border-output ring-1 ring-output/40", m.id !== selectedId && !isInvalid && !ioLinked && !status && !coverage && "hover:border-output/80 hover:bg-output/10"),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center justify-center gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepIndex, {
                                                index: i,
                                                className: "text-output/80"
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-canvas.tsx",
                                                lineNumber: 313,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["KindIcon"], {
                                                kind: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ModuleKind"].Output
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-canvas.tsx",
                                                lineNumber: 314,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/pipeline-canvas.tsx",
                                        lineNumber: 312,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepBody, {
                                        label: m.label,
                                        centered: true,
                                        detail: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                                                    models: models,
                                                    structureId: m.inStructureId
                                                }, void 0, false, {
                                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                                    lineNumber: 321,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-output/80",
                                                    children: " · snapshot"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                                    lineNumber: 322,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true)
                                    }, void 0, false, {
                                        fileName: "[project]/components/pipeline-canvas.tsx",
                                        lineNumber: 316,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center justify-center gap-1.5",
                                        children: [
                                            m.cached && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__["Zap"], {
                                                className: "h-3.5 w-3.5 shrink-0 text-primary"
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-canvas.tsx",
                                                lineNumber: 327,
                                                columnNumber: 30
                                            }, this),
                                            coverage && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TestCoverageBadge, {
                                                status: coverage
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-canvas.tsx",
                                                lineNumber: 328,
                                                columnNumber: 30
                                            }, this),
                                            (isInvalid || ioLinked || status) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepTrailingIcon, {
                                                invalid: isInvalid || ioLinked,
                                                status: status,
                                                editMode: editMode
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-canvas.tsx",
                                                lineNumber: 330,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/pipeline-canvas.tsx",
                                        lineNumber: 326,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/pipeline-canvas.tsx",
                                lineNumber: 294,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$right$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowRight$3e$__["ArrowRight"], {
                                className: "pointer-events-none absolute left-full top-1/2 ml-2 h-4 w-4 -translate-y-1/2 text-output",
                                "aria-hidden": true
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-canvas.tsx",
                                lineNumber: 334,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/pipeline-canvas.tsx",
                        lineNumber: 293,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-canvas.tsx",
                    lineNumber: 292,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(InvalidMessage, {
                    show: isInvalid,
                    message: isInvalid ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$messages$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["invalidStepMessage"])(stepIssue, models, modules) : undefined,
                    className: "max-w-xs"
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-canvas.tsx",
                    lineNumber: 340,
                    columnNumber: 9
                }, this),
                renderInsertAfter?.(insertAt, {
                    blocked,
                    connectionInvalid
                }) ?? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineConnector"], {
                    invalid: connectionInvalid
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-canvas.tsx",
                    lineNumber: 346,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/pipeline-canvas.tsx",
            lineNumber: 291,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mx-auto flex w-full flex-col items-center",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepButton, {
                onClick: ()=>onSelect?.(m.id),
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("group relative flex w-full items-start gap-3 rounded-lg border bg-card px-3.5 py-3 text-left transition-colors", locked && (autoStruct ? "border-dashed border-chart-3/50 bg-chart-3/5" : "border-dashed border-chart-2/50 bg-chart-2/5"), isInvalid ? "border-destructive/70" : ioLinked ? "border-destructive/60" : testCoverageBorder(coverage, m.id === selectedId) ?? statusBorder(status) ?? (m.id === selectedId ? "border-primary ring-1 ring-primary/30" : !locked && "border-border hover:border-muted-foreground/40")),
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepIndex, {
                        index: i
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-canvas.tsx",
                        lineNumber: 371,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["KindIcon"], {
                        kind: m.kind
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-canvas.tsx",
                        lineNumber: 372,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepBody, {
                        label: m.label,
                        detail: m.kind === "input" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                                    models: models,
                                    structureId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["inputTargetStructureId"])(m, modules)
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 378,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-muted-foreground/60",
                                    children: " · "
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 379,
                                    columnNumber: 17
                                }, this),
                                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["inputTypeLabel"])(m.inputType)
                            ]
                        }, void 0, true) : autoQuote ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                                    models: models,
                                    structureId: m.inStructureId
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 384,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-muted-foreground/60",
                                    children: " · same model in/out"
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 385,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true) : autoStruct ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                                    models: models,
                                    structureId: m.inStructureId
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 389,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-muted-foreground/60",
                                    children: " → "
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 390,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                                    models: models,
                                    structureId: m.outStructureId
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 391,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                                    models: models,
                                    structureId: m.inStructureId
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 395,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-muted-foreground/60",
                                    children: " → "
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 396,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                                    models: models,
                                    structureId: m.outStructureId
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-canvas.tsx",
                                    lineNumber: 397,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true)
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-canvas.tsx",
                        lineNumber: 373,
                        columnNumber: 9
                    }, this),
                    autoQuote && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AutoQuoteLock"], {}, void 0, false, {
                        fileName: "[project]/components/pipeline-canvas.tsx",
                        lineNumber: 402,
                        columnNumber: 23
                    }, this),
                    autoStruct && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AutoStructureParseLock"], {}, void 0, false, {
                        fileName: "[project]/components/pipeline-canvas.tsx",
                        lineNumber: 403,
                        columnNumber: 24
                    }, this),
                    m.kind === "llm" && m.model && (editMode ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                        variant: "outline",
                        className: "shrink-0 font-mono text-[9px]",
                        children: m.model
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-canvas.tsx",
                        lineNumber: 406,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[9px]",
                        children: m.model
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-canvas.tsx",
                        lineNumber: 410,
                        columnNumber: 13
                    }, this)),
                    m.cached && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__["Zap"], {
                        className: "h-3.5 w-3.5 shrink-0 text-primary"
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-canvas.tsx",
                        lineNumber: 415,
                        columnNumber: 22
                    }, this),
                    coverage && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TestCoverageBadge, {
                        status: coverage
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-canvas.tsx",
                        lineNumber: 416,
                        columnNumber: 22
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepTrailingIcon, {
                        invalid: isInvalid || ioLinked,
                        status: status,
                        editMode: editMode
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-canvas.tsx",
                        lineNumber: 417,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/pipeline-canvas.tsx",
                lineNumber: 354,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(InvalidMessage, {
                show: isInvalid,
                message: isInvalid ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$messages$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["invalidStepMessage"])(stepIssue, models, modules) : undefined
            }, void 0, false, {
                fileName: "[project]/components/pipeline-canvas.tsx",
                lineNumber: 419,
                columnNumber: 7
            }, this),
            !isInvalid && stepWarnings?.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-1 space-y-0.5",
                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$messages$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["warningStepMessages"])(stepWarnings, models, modules).map((msg, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-center font-mono text-[10px]", __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ui$2d$classes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WARNING_TEXT_CLASS"]),
                        children: msg
                    }, i, false, {
                        fileName: "[project]/components/pipeline-canvas.tsx",
                        lineNumber: 426,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/components/pipeline-canvas.tsx",
                lineNumber: 424,
                columnNumber: 9
            }, this) : null,
            renderInsertAfter?.(insertAt, {
                blocked,
                connectionInvalid
            }) ?? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineConnector"], {
                invalid: connectionInvalid
            }, void 0, false, {
                fileName: "[project]/components/pipeline-canvas.tsx",
                lineNumber: 433,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/pipeline-canvas.tsx",
        lineNumber: 353,
        columnNumber: 5
    }, this);
}
_c1 = SegmentRow;
function PipelineCanvasSegment({ showConnector = true, className: _className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SegmentRow, {
        ...props,
        editMode: false,
        renderInsertAfter: showConnector ? undefined : ()=>null
    }, void 0, false, {
        fileName: "[project]/components/pipeline-canvas.tsx",
        lineNumber: 460,
        columnNumber: 5
    }, this);
}
_c2 = PipelineCanvasSegment;
function PipelineCanvasConnector({ invalid }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mx-auto flex w-full flex-col items-center",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineConnector"], {
            invalid: invalid
        }, void 0, false, {
            fileName: "[project]/components/pipeline-canvas.tsx",
            lineNumber: 471,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/pipeline-canvas.tsx",
        lineNumber: 470,
        columnNumber: 5
    }, this);
}
_c3 = PipelineCanvasConnector;
function PipelineCanvasStart() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mx-auto flex w-full flex-col items-center",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineNode"], {
            label: "Start",
            subtle: true
        }, void 0, false, {
            fileName: "[project]/components/pipeline-canvas.tsx",
            lineNumber: 479,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/pipeline-canvas.tsx",
        lineNumber: 478,
        columnNumber: 5
    }, this);
}
_c4 = PipelineCanvasStart;
function PipelineCanvasEnd() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mx-auto flex w-full flex-col items-center",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineNode"], {
            label: "End",
            subtle: true
        }, void 0, false, {
            fileName: "[project]/components/pipeline-canvas.tsx",
            lineNumber: 487,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/pipeline-canvas.tsx",
        lineNumber: 486,
        columnNumber: 5
    }, this);
}
_c5 = PipelineCanvasEnd;
function StepButton({ onClick, className, children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        onClick: onClick,
        className: className,
        children: children
    }, void 0, false, {
        fileName: "[project]/components/pipeline-canvas.tsx",
        lineNumber: 502,
        columnNumber: 5
    }, this);
}
_c6 = StepButton;
function StepIndex({ index, className }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("font-mono text-[10px] text-muted-foreground", className),
        children: String(index + 1).padStart(2, "0")
    }, void 0, false, {
        fileName: "[project]/components/pipeline-canvas.tsx",
        lineNumber: 510,
        columnNumber: 5
    }, this);
}
_c7 = StepIndex;
function StepBody({ label, detail, labelClass, centered }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("min-w-0 flex-1", centered && "w-full"),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("line-clamp-2 text-sm font-medium leading-snug", labelClass, centered && "text-center"),
                children: label
            }, void 0, false, {
                fileName: "[project]/components/pipeline-canvas.tsx",
                lineNumber: 529,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("line-clamp-2 font-mono text-[10px] leading-snug text-muted-foreground", centered && "text-center"),
                children: detail
            }, void 0, false, {
                fileName: "[project]/components/pipeline-canvas.tsx",
                lineNumber: 532,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/pipeline-canvas.tsx",
        lineNumber: 528,
        columnNumber: 5
    }, this);
}
_c8 = StepBody;
function InvalidMessage({ show, message, className }) {
    if (!show || !message) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("mt-1 text-center font-mono text-[10px] text-destructive", className),
        children: message
    }, void 0, false, {
        fileName: "[project]/components/pipeline-canvas.tsx",
        lineNumber: 550,
        columnNumber: 5
    }, this);
}
_c9 = InvalidMessage;
function StepTrailingIcon({ invalid, status, editMode }) {
    _s();
    const palette = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$color$2d$scheme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStatusPalette"])();
    if (invalid) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__["AlertTriangle"], {
        className: "h-3.5 w-3.5 shrink-0",
        style: {
            color: palette.err
        }
    }, void 0, false, {
        fileName: "[project]/components/pipeline-canvas.tsx",
        lineNumber: 566,
        columnNumber: 23
    }, this);
    if (!editMode) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RunStatusIcon, {
        status: status
    }, void 0, false, {
        fileName: "[project]/components/pipeline-canvas.tsx",
        lineNumber: 567,
        columnNumber: 25
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$right$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronRight$3e$__["ChevronRight"], {
        className: "h-3.5 w-3.5 shrink-0 text-muted-foreground"
    }, void 0, false, {
        fileName: "[project]/components/pipeline-canvas.tsx",
        lineNumber: 568,
        columnNumber: 10
    }, this);
}
_s(StepTrailingIcon, "3LyLMFB4UyoKLt7LceHsDYzJsck=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$color$2d$scheme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStatusPalette"]
    ];
});
_c10 = StepTrailingIcon;
// AI : returns className for border/bg — uses destructive/chart-3/primary CSS vars (subtle cues).
// Icon colors (the primary status signal) are handled by RunStatusIcon/StepTrailingIcon via useStatusPalette.
function statusBorder(status) {
    if (status === "error") return "border-destructive/70 bg-destructive/5";
    if (status === "cached") return "border-chart-3/50 bg-chart-3/5";
    if (status === "ok") return "border-primary/40";
    return undefined;
}
function testCoverageBorder(status, selected) {
    if (!status) return undefined;
    const selectedRing = selected ? "ring-1 ring-primary/40" : undefined;
    switch(status){
        case "tracked":
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("border-chart-2/50 bg-chart-2/5", selectedRing);
        case "untracked":
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("border-dashed border-muted-foreground/45 bg-muted/10", selectedRing);
        case "input":
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("border-sky-500/40 bg-sky-500/5", selectedRing);
        case "passthrough":
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("border-dashed border-muted-foreground/30 bg-muted/15", selectedRing);
    }
}
function TestCoverageBadge({ status }) {
    if (status === "tracked") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
            variant: "outline",
            className: "shrink-0 border-chart-2/40 font-mono text-[9px] text-chart-2",
            children: "checked"
        }, void 0, false, {
            fileName: "[project]/components/pipeline-canvas.tsx",
            lineNumber: 601,
            columnNumber: 7
        }, this);
    }
    if (status === "untracked") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
            variant: "outline",
            className: "shrink-0 border-muted-foreground/40 font-mono text-[9px] text-muted-foreground",
            children: "not checked"
        }, void 0, false, {
            fileName: "[project]/components/pipeline-canvas.tsx",
            lineNumber: 608,
            columnNumber: 7
        }, this);
    }
    if (status === "input") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
            variant: "outline",
            className: "shrink-0 border-sky-500/40 font-mono text-[9px] text-sky-600",
            children: "input"
        }, void 0, false, {
            fileName: "[project]/components/pipeline-canvas.tsx",
            lineNumber: 615,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
        variant: "outline",
        className: "shrink-0 border-muted-foreground/35 font-mono text-[9px] text-muted-foreground",
        children: "skip"
    }, void 0, false, {
        fileName: "[project]/components/pipeline-canvas.tsx",
        lineNumber: 621,
        columnNumber: 5
    }, this);
}
_c11 = TestCoverageBadge;
function RunStatusIcon({ status }) {
    _s1();
    const palette = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$color$2d$scheme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStatusPalette"])();
    if (status === "cached") return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__["Zap"], {
        className: "h-3.5 w-3.5 shrink-0 text-chart-3"
    }, void 0, false, {
        fileName: "[project]/components/pipeline-canvas.tsx",
        lineNumber: 629,
        columnNumber: 35
    }, this);
    if (status === "error") return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__["AlertTriangle"], {
        className: "h-3.5 w-3.5 shrink-0",
        style: {
            color: palette.err
        }
    }, void 0, false, {
        fileName: "[project]/components/pipeline-canvas.tsx",
        lineNumber: 630,
        columnNumber: 34
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$right$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronRight$3e$__["ChevronRight"], {
        className: "h-3.5 w-3.5 shrink-0 text-muted-foreground"
    }, void 0, false, {
        fileName: "[project]/components/pipeline-canvas.tsx",
        lineNumber: 631,
        columnNumber: 10
    }, this);
}
_s1(RunStatusIcon, "3LyLMFB4UyoKLt7LceHsDYzJsck=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$color$2d$scheme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStatusPalette"]
    ];
});
_c12 = RunStatusIcon;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c10, _c11, _c12;
__turbopack_context__.k.register(_c, "PipelineCanvas");
__turbopack_context__.k.register(_c1, "SegmentRow");
__turbopack_context__.k.register(_c2, "PipelineCanvasSegment");
__turbopack_context__.k.register(_c3, "PipelineCanvasConnector");
__turbopack_context__.k.register(_c4, "PipelineCanvasStart");
__turbopack_context__.k.register(_c5, "PipelineCanvasEnd");
__turbopack_context__.k.register(_c6, "StepButton");
__turbopack_context__.k.register(_c7, "StepIndex");
__turbopack_context__.k.register(_c8, "StepBody");
__turbopack_context__.k.register(_c9, "InvalidMessage");
__turbopack_context__.k.register(_c10, "StepTrailingIcon");
__turbopack_context__.k.register(_c11, "TestCoverageBadge");
__turbopack_context__.k.register(_c12, "RunStatusIcon");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/open-in-documents.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OpenInDocumentsLink",
    ()=>OpenInDocumentsLink
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$files$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Files$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/files.mjs [app-client] (ecmascript) <export default as Files>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/store.tsx [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$shell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/app-shell.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
function OpenInDocumentsLink({ docId, label = "documents", className, stopPropagation = true, variant = "inline" }) {
    _s();
    const store = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useOptionalStore"])();
    const shell = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$shell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useOptionalAppShell"])();
    if (!shell) return null;
    const resolvedLabel = variant === "source" && docId ? `from ${store?.docs.find((d)=>d.id === docId)?.name ?? docId.slice(0, 8)}` : label;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        onClick: (e)=>{
            if (stopPropagation) e.stopPropagation();
            shell.openDocuments(docId);
        },
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(variant === "source" ? "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary" : "inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-primary", className),
        title: variant === "source" ? "Open source document in Documents tab" : "Open in the Documents store",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$files$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Files$3e$__["Files"], {
                className: "h-3 w-3 shrink-0"
            }, void 0, false, {
                fileName: "[project]/components/open-in-documents.tsx",
                lineNumber: 50,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: variant === "source" ? "truncate" : undefined,
                children: resolvedLabel
            }, void 0, false, {
                fileName: "[project]/components/open-in-documents.tsx",
                lineNumber: 51,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/open-in-documents.tsx",
        lineNumber: 32,
        columnNumber: 5
    }, this);
}
_s(OpenInDocumentsLink, "nrGzaUKKJhTj/4jeLivlZtv53To=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useOptionalStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$shell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useOptionalAppShell"]
    ];
});
_c = OpenInDocumentsLink;
var _c;
__turbopack_context__.k.register(_c, "OpenInDocumentsLink");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/schema-form.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// AI : guided JSON form over JSON Schema — ported from automic_code/edit_given_struct for Testing.
__turbopack_context__.s([
    "applySchemaDefaults",
    ()=>applySchemaDefaults,
    "defaultFromSchema",
    ()=>defaultFromSchema,
    "friendlyType",
    ()=>friendlyType,
    "humanizeKey",
    ()=>humanizeKey,
    "jsonSchemaToFormRoot",
    ()=>jsonSchemaToFormRoot,
    "validateFormData",
    ()=>validateFormData
]);
function humanizeKey(key) {
    return key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c)=>c.toUpperCase());
}
function asRecord(v) {
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}
function resolveSchemaType(raw) {
    const t = raw.type;
    if (t === "string" || t === "number" || t === "integer" || t === "boolean" || t === "array" || t === "object") {
        return t;
    }
    if (raw.properties) return "object";
    if (raw.items) return "array";
    if (Array.isArray(raw.enum)) return "string";
    return null;
}
function normalizeNode(raw, key, required) {
    const s = asRecord(raw);
    if (!s) return null;
    if ("anyOf" in s || "oneOf" in s || "allOf" in s || "$ref" in s) return null;
    const type = resolveSchemaType(s);
    if (!type) return null;
    const node = {
        key,
        title: typeof s.title === "string" ? s.title : undefined,
        description: typeof s.description === "string" ? s.description : undefined,
        type,
        required
    };
    if (typeof s.format === "string") node.format = s.format;
    if (Array.isArray(s.enum) && s.enum.every((v)=>typeof v === "string")) node.enum = s.enum;
    if (typeof s.minimum === "number") node.minimum = s.minimum;
    if (typeof s.maximum === "number") node.maximum = s.maximum;
    if (typeof s.minLength === "number") node.minLength = s.minLength;
    if (typeof s.maxLength === "number") node.maxLength = s.maxLength;
    if (typeof s.pattern === "string") node.pattern = s.pattern;
    if (typeof s.minItems === "number") node.minItems = s.minItems;
    if (typeof s.maxItems === "number") node.maxItems = s.maxItems;
    if (type === "object") {
        const props = asRecord(s.properties);
        if (!props) return null;
        const req = Array.isArray(s.required) ? s.required : [];
        const properties = {};
        for (const [k, sub] of Object.entries(props)){
            const child = normalizeNode(sub, k, req.includes(k));
            if (!child) return null;
            properties[k] = child;
        }
        node.properties = properties;
    }
    if (type === "array") {
        const item = normalizeNode(s.items, "item", true);
        if (!item) return null;
        node.items = item;
    }
    return node;
}
function jsonSchemaToFormRoot(schema) {
    return normalizeNode(schema, "root", true);
}
// AI : when score/max_score are present, derive correct before generic defaults (SectionGrade-style rows).
function inferScoreCorrectFields(obj) {
    const score = obj.score;
    const maxScore = obj.max_score;
    if (typeof score !== "number" || typeof maxScore !== "number") return;
    if (obj.correct === undefined || obj.correct === null) obj.correct = score === maxScore;
}
function fieldMissing(val, type) {
    return val === undefined || val === null || type !== "boolean" && val === "";
}
function applySchemaDefaults(data, node) {
    if (node.type === "object" && node.properties) {
        const raw = data && typeof data === "object" && !Array.isArray(data) ? {
            ...data
        } : {};
        inferScoreCorrectFields(raw);
        for (const [k, sub] of Object.entries(node.properties)){
            const val = raw[k];
            if (fieldMissing(val, sub.type) && sub.required) raw[k] = defaultFromSchema(sub);
            else if (!fieldMissing(val, sub.type) && (sub.type === "object" || sub.type === "array")) {
                raw[k] = applySchemaDefaults(val, sub);
            }
        }
        return raw;
    }
    if (node.type === "array" && node.items) {
        if (!Array.isArray(data)) return data;
        return data.map((item)=>applySchemaDefaults(item, node.items));
    }
    return data;
}
function defaultFromSchema(node) {
    if (node.type === "object" && node.properties) {
        const o = {};
        for (const [k, sub] of Object.entries(node.properties)){
            if (!sub.required) continue;
            o[k] = defaultFromSchema(sub);
        }
        return o;
    }
    if (node.type === "array") {
        const n = node.minItems ? Math.max(1, node.minItems) : 0;
        return Array.from({
            length: Math.min(n, 1)
        }, ()=>defaultFromSchema(node.items ?? scalarFallback()));
    }
    return exampleScalar(node);
}
function scalarFallback() {
    return {
        key: "item",
        type: "string",
        required: true
    };
}
function exampleScalar(node) {
    if (node.enum?.length) return node.enum[0];
    if (node.type === "boolean") return false;
    if (node.type === "integer") return node.minimum != null ? Math.max(node.minimum, 0) : 0;
    if (node.type === "number") return node.minimum != null ? Math.max(node.minimum, 0) : 0;
    if (node.format === "email") return "user@example.com";
    if (node.format === "uri") return "https://example.com";
    if (node.format === "date-time") return new Date().toISOString();
    if (node.minLength) return "x".repeat(node.minLength);
    return "";
}
function friendlyType(node) {
    if (node.enum) return "Choice";
    if (node.format === "date-time") return "Date & time";
    if (node.format === "email") return "Email";
    if (node.format === "uri") return "URL";
    return ({
        string: "Text",
        number: "Number",
        integer: "Number",
        boolean: "Yes / No",
        array: "List",
        object: "Group"
    })[node.type] ?? "Value";
}
function validateFormData(data, node, path = "") {
    const errors = {};
    if (node.type === "object" && node.properties) {
        if (typeof data !== "object" || data === null || Array.isArray(data)) {
            errors[path || "root"] = "Expected a group of fields";
            return errors;
        }
        const obj = data;
        for (const [k, sub] of Object.entries(node.properties)){
            const p = path ? `${path}.${k}` : k;
            const val = obj[k];
            const missing = fieldMissing(val, sub.type);
            if (sub.required && missing) {
                errors[p] = "Required";
                continue;
            }
            if (!missing) Object.assign(errors, validateFormData(val, sub, p));
        }
        return errors;
    }
    if (node.type === "array") {
        if (!Array.isArray(data)) {
            errors[path] = "Expected a list";
            return errors;
        }
        if (node.minItems != null && data.length < node.minItems) errors[path] = `At least ${node.minItems} item(s)`;
        if (node.maxItems != null && data.length > node.maxItems) errors[path] = `At most ${node.maxItems} item(s)`;
        data.forEach((item, i)=>Object.assign(errors, validateFormData(item, node.items ?? scalarFallback(), `${path}[${i}]`)));
        return errors;
    }
    if (data === undefined || data === null || data === "") return errors;
    if (node.type === "integer" && (!Number.isInteger(data) || typeof data !== "number")) {
        errors[path] = "Must be a whole number";
    }
    if (node.type === "number" && typeof data !== "number") errors[path] = "Must be a number";
    if (node.type === "boolean" && typeof data !== "boolean") errors[path] = "Must be yes or no";
    if (node.type === "string" && typeof data !== "string") errors[path] = "Must be text";
    if (typeof data === "string") {
        if (node.minLength != null && data.length < node.minLength) errors[path] = `At least ${node.minLength} characters`;
        if (node.maxLength != null && data.length > node.maxLength) errors[path] = `At most ${node.maxLength} characters`;
        if (node.format === "email" && !/^[^@]+@[^@]+\.[^@]+$/.test(data)) errors[path] = "Invalid email";
        if (node.format === "uri" && !/^https?:\/\/.+/.test(data)) errors[path] = "Invalid URL";
        if (node.pattern) {
            try {
                if (!new RegExp(node.pattern).test(data)) errors[path] = "Invalid format";
            } catch  {
            /* skip bad pattern */ }
        }
        if (node.enum && !node.enum.includes(data)) errors[path] = "Pick a valid option";
    }
    if (typeof data === "number") {
        if (node.minimum != null && data < node.minimum) errors[path] = `Minimum ${node.minimum}`;
        if (node.maximum != null && data > node.maximum) errors[path] = `Maximum ${node.maximum}`;
    }
    return errors;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/server/pipeline_state.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "emptyPipelineState",
    ()=>emptyPipelineState,
    "labelAsStateKey",
    ()=>labelAsStateKey,
    "labelsForModules",
    ()=>labelsForModules,
    "modelZodFromProject",
    ()=>modelZodFromProject,
    "pipelineStateFields",
    ()=>pipelineStateFields,
    "pipelineStatePyTypedDict",
    ()=>pipelineStatePyTypedDict,
    "pipelineStateSchema",
    ()=>pipelineStateSchema,
    "pipelineStateTsInterface",
    ()=>pipelineStateTsInterface,
    "validatePipelineState",
    ()=>validatePipelineState,
    "validatePipelineStateEntry",
    ()=>validatePipelineStateEntry
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-client] (ecmascript) <export * as z>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/type_expr.ts [app-client] (ecmascript)");
;
;
function emptyPipelineState() {
    return {};
}
function labelAsStateKey(label) {
    return label.trim();
}
function labelsForModules(modules) {
    return modules.map((m)=>labelAsStateKey(m.label)).filter(Boolean);
}
function pipelineStateFields(project) {
    const fields = [];
    for (const m of project.modules){
        const label = labelAsStateKey(m.label);
        if (!label) continue;
        const spine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["stepSpineOutType"])(m);
        if (!spine) continue;
        fields.push({
            label,
            moduleId: m.id,
            type: spine
        });
    }
    return fields;
}
function pipelineStateSchema(project) {
    const typeAliases = project.typeAliases ?? [];
    const shape = {};
    for (const field of pipelineStateFields(project)){
        if (!field.type) continue;
        shape[field.label] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["typeExprToZod"])(field.type, project.models, new Set(), false, typeAliases);
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object(shape);
}
function pipelineStatePyTypedDict(project) {
    const lines = pipelineStateFields(project).map((f)=>{
        const key = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelToPyKey"])(f.label);
        const t = f.type ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatTypeExpr"])(f.type, project.models) : "Any";
        return `    ${key}: ${t}  # "${f.label}"`;
    });
    if (!lines.length) return "class PipelineState(TypedDict):\n    pass\n";
    return `class PipelineState(TypedDict, total=False):\n${lines.join("\n")}\n`;
}
function pipelineStateTsInterface(project) {
    const lines = pipelineStateFields(project).map((f)=>{
        const t = f.type ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["typeExprToTs"])(f.type, project.models) : "unknown";
        return `  ${JSON.stringify(f.label)}: ${t};`;
    });
    if (!lines.length) return "export type PipelineState = Record<string, never>;";
    return `export type PipelineState = {\n${lines.join("\n")}\n};`;
}
function validatePipelineStateEntry(label, value, project) {
    const field = pipelineStateFields(project).find((f)=>f.label === label);
    if (!field?.type) return {
        ok: true
    };
    const typeAliases = project.typeAliases ?? [];
    const schema = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["typeExprToZod"])(field.type, project.models, new Set(), false, typeAliases);
    const parsed = schema.safeParse(value);
    if (parsed.success) return {
        ok: true
    };
    return {
        ok: false,
        error: JSON.stringify(parsed.error.issues, null, 2)
    };
}
function validatePipelineState(state, project) {
    const schema = pipelineStateSchema(project);
    const parsed = schema.safeParse(state);
    if (parsed.success) return {
        ok: true,
        errors: []
    };
    const errors = parsed.error.issues.map((issue)=>({
            label: String(issue.path[0] ?? "?"),
            error: issue.message
        }));
    return {
        ok: false,
        errors
    };
}
function modelZodFromProject(model, project) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["zodFromModel"])(model, project.models);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/step-json-schema.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "stepOutputJsonSchema",
    ()=>stepOutputJsonSchema
]);
// AI : JSON Schema for a pipeline step's spine output — drives the guided form in Testing.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-client] (ecmascript) <export * as z>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/pipeline_state.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/type_expr.ts [app-client] (ecmascript)");
;
;
;
function stepOutputJsonSchema(project, label) {
    const key = label.trim();
    const field = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pipelineStateFields"])(project).find((f)=>f.label === key);
    if (!field?.type) return null;
    const zodSchema = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["typeExprToZod"])(field.type, project.models, new Set(), false, project.typeAliases ?? []);
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].toJSONSchema(zodSchema);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/json-diff.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "jsonUnifiedDiff",
    ()=>jsonUnifiedDiff,
    "jsonUnifiedDiffSourceIndexes",
    ()=>jsonUnifiedDiffSourceIndexes
]);
// AI : line unified diff for test failures — git-diff style over pretty-printed JSON.
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$deep_equal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/deep_equal.ts [app-client] (ecmascript)");
;
function prettyJsonLines(value) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$deep_equal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["stablePrettyJson"])(value).split("\n");
}
function jsonUnifiedDiff(expected, actual) {
    const a = prettyJsonLines(expected);
    const b = prettyJsonLines(actual);
    const out = [];
    const n = Math.max(a.length, b.length);
    for(let i = 0; i < n; i++){
        const left = a[i];
        const right = b[i];
        if (left === right) {
            if (left !== undefined) out.push(` ${left}`);
            continue;
        }
        if (left !== undefined) out.push(`-${left}`);
        if (right !== undefined) out.push(`+${right}`);
    }
    return out.join("\n");
}
function jsonUnifiedDiffSourceIndexes(expected, actual) {
    const a = prettyJsonLines(expected);
    const b = prettyJsonLines(actual);
    const out = [];
    const n = Math.max(a.length, b.length);
    for(let i = 0; i < n; i++){
        const left = a[i];
        const right = b[i];
        if (left === right) {
            if (left !== undefined) out.push(undefined);
            continue;
        }
        if (left !== undefined) out.push(i);
        if (right !== undefined) out.push(i);
    }
    return out;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/error-copy.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// AI : clipboard payloads for UI errors — include where the banner lives plus stack when available.
__turbopack_context__.s([
    "captureThrownError",
    ()=>captureThrownError,
    "formatErrorForClipboard",
    ()=>formatErrorForClipboard
]);
function captureThrownError(err) {
    if (err instanceof Error) return {
        message: err.message,
        stack: err.stack
    };
    return {
        message: String(err)
    };
}
function formatErrorForClipboard(fields) {
    const lines = [
        `UI location: ${fields.uiLocation}`
    ];
    if (fields.context) {
        for (const [key, value] of Object.entries(fields.context)){
            if (value) lines.push(`${key}: ${value}`);
        }
    }
    lines.push(`Error: ${fields.summary}`);
    if (fields.detail?.trim() && fields.detail.trim() !== fields.summary.trim()) {
        lines.push(`Detail: ${fields.detail.trim()}`);
    }
    if (fields.stack?.trim()) {
        lines.push("", "Stack trace:", fields.stack.trim());
    }
    return lines.join("\n");
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/seed-doc.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isUnavailableSeedDoc",
    ()=>isUnavailableSeedDoc,
    "looksLikeUnavailableSeedDoc",
    ()=>looksLikeUnavailableSeedDoc,
    "unavailableSeedDocMessage",
    ()=>unavailableSeedDocMessage
]);
// AI : shared seed-doc helpers — safe on client + server (no fs imports).
const UNAVAILABLE_PREFIX = "[seed doc unavailable on this deploy:";
function unavailableSeedDocMessage(name) {
    return `${UNAVAILABLE_PREFIX} ${name}]`;
}
function isUnavailableSeedDoc(content, name) {
    return content === unavailableSeedDocMessage(name);
}
function looksLikeUnavailableSeedDoc(content) {
    return content.startsWith(UNAVAILABLE_PREFIX);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/inference-validity.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "collectInferenceInputIssues",
    ()=>collectInferenceInputIssues,
    "inferenceDocNeedsFullContent",
    ()=>inferenceDocNeedsFullContent,
    "inferenceInputIssueClipboard",
    ()=>inferenceInputIssueClipboard,
    "inferenceInputIssueMessage",
    ()=>inferenceInputIssueMessage,
    "validateInferenceDocAssignment",
    ()=>validateInferenceDocAssignment,
    "validateInferenceDocContent",
    ()=>validateInferenceDocContent,
    "validateInferenceDocPreview",
    ()=>validateInferenceDocPreview
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$error$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/error-copy.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seed$2d$doc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/seed-doc.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/inference-input.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$picker$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/inference-input-picker.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/inference-input-core.ts [app-client] (ecmascript)");
;
;
;
;
function assignmentIssueMessage(reason, inputModule) {
    if (reason === "wrong-type") {
        return `expected ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["inputTypeLabel"])(inputModule.inputType)} document for this input step`;
    }
    const required = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["inputNameRestrictionLabel"])(inputModule);
    return `filename must contain "${required ?? ""}"`;
}
function validateInferenceDocAssignment(inputModule, doc) {
    const reason = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$picker$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["exclusionReasonForInputModule"])(doc, inputModule);
    if (!reason) return undefined;
    return {
        moduleId: inputModule.id,
        docName: doc.name,
        inputLabel: inputModule.label,
        message: assignmentIssueMessage(reason, inputModule)
    };
}
function validateInferenceDocContent(inputModule, doc, content) {
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seed$2d$doc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isUnavailableSeedDoc"])(content, doc.name) || (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seed$2d$doc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["looksLikeUnavailableSeedDoc"])(content)) {
        return {
            moduleId: inputModule.id,
            docName: doc.name,
            inputLabel: inputModule.label,
            message: `seed doc missing on deploy — run sync-seeds or upload ${doc.name}`
        };
    }
    if (doc.type === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["InputType"].Json && (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["inputTypesForModule"])(inputModule).includes(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["InputType"].Json)) {
        try {
            JSON.parse(content);
        } catch (err) {
            const { message, stack } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$error$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["captureThrownError"])(err);
            const emptyHint = content.trim() ? "" : " (document is empty)";
            return {
                moduleId: inputModule.id,
                docName: doc.name,
                inputLabel: inputModule.label,
                contentLength: content.length,
                message: `invalid JSON${emptyHint}: ${message}`,
                stack
            };
        }
    }
    return undefined;
}
function validateInferenceDocPreview(inputModule, doc) {
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seed$2d$doc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isUnavailableSeedDoc"])(doc.preview, doc.name) || (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seed$2d$doc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["looksLikeUnavailableSeedDoc"])(doc.preview)) {
        return {
            moduleId: inputModule.id,
            docName: doc.name,
            inputLabel: inputModule.label,
            message: `seed doc missing on deploy — run sync-seeds or upload ${doc.name}`
        };
    }
    return undefined;
}
function inferenceDocNeedsFullContent(inputModule, doc) {
    return doc.type === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["InputType"].Json && (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["inputTypesForModule"])(inputModule).includes(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["InputType"].Json);
}
function collectInferenceInputIssues(inputModules, inputDocs, contentByDocId, assignment) {
    const issues = [];
    const fullAssignment = assignment ?? inputDocs;
    for (const m of inputModules){
        const docs = assignment ? Array.isArray(fullAssignment[m.id]) ? fullAssignment[m.id] : fullAssignment[m.id] ? [
            fullAssignment[m.id]
        ] : [] : inputDocs[m.id] ? [
            inputDocs[m.id]
        ] : [];
        if (!docs.length) continue;
        for (const doc of docs){
            const assignmentIssue = validateInferenceDocAssignment(m, doc);
            if (assignmentIssue) {
                issues.push(assignmentIssue);
                continue;
            }
            const content = contentByDocId[doc.id];
            const issue = content !== undefined ? validateInferenceDocContent(m, doc, content) : validateInferenceDocPreview(m, doc);
            if (issue) issues.push(issue);
        }
    }
    return issues;
}
function issueWhereLabel(issue, inputModules) {
    const label = issue.inputLabel ?? inputModules?.find((m)=>m.id === issue.moduleId)?.label;
    return label ? `${label} · ${issue.docName}` : issue.docName;
}
function inferenceInputIssueMessage(issues, inputModules) {
    if (!issues.length) return "";
    const first = issues[0];
    return `${issueWhereLabel(first, inputModules)}: ${first.message}`;
}
function inferenceInputIssueClipboard(issues, uiLocation, inputModules) {
    if (!issues.length) return "";
    return issues.map((issue, i)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$error$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatErrorForClipboard"])({
            uiLocation: issues.length > 1 ? `${uiLocation} (issue ${i + 1}/${issues.length})` : uiLocation,
            summary: issue.message,
            context: {
                ...issue.inputLabel ? {
                    "Input step": issue.inputLabel
                } : {},
                Document: issue.docName,
                ...issue.contentLength !== undefined ? {
                    "Content length (bytes)": String(issue.contentLength)
                } : {}
            },
            stack: issue.stack
        })).join("\n\n---\n\n");
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/inference-presets.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "flattenNamedInputs",
    ()=>flattenNamedInputs,
    "namedInputDocNames",
    ()=>namedInputDocNames,
    "resolveNamedRunInputs",
    ()=>resolveNamedRunInputs
]);
// AI : named pre-selected runs — one resolver shared by inference presets AND *_testing.json tests,
// AI : so "input step label → doc name(s)" only resolves to run docs in one place.
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$validity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/inference-validity.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/pipeline_state.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/inference-input-core.ts [app-client] (ecmascript)");
;
;
;
function namedInputDocNames(value) {
    return (Array.isArray(value) ? value : [
        value
    ]).filter((n)=>n.trim());
}
function flattenNamedInputs(inputs) {
    return Object.values(inputs).flatMap(namedInputDocNames);
}
function resolveNamedRunInputs(inputs, modules, projectDocs) {
    const byModule = {};
    const assignment = {};
    const ordered = [];
    for (const m of (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["orderedInputModules"])(modules)){
        const key = Object.keys(inputs).find((l)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(l) === (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(m.label));
        const names = key ? namedInputDocNames(inputs[key]) : [];
        if (!names.length) return {
            ok: false,
            error: `no input document set for step "${m.label}"`
        };
        const refs = [];
        for (const name of names){
            const doc = projectDocs.find((d)=>d.name === name);
            if (!doc) return {
                ok: false,
                error: `document "${name}" not found for step "${m.label}"`
            };
            const assignmentIssue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$validity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateInferenceDocAssignment"])(m, doc);
            if (assignmentIssue) {
                return {
                    ok: false,
                    error: `${doc.name}: ${assignmentIssue.message} (step "${m.label}")`
                };
            }
            refs.push(doc);
        }
        byModule[m.id] = refs.map((d)=>d.id);
        assignment[m.id] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isMultiDocInputModule"])(m) ? refs : refs[0];
        ordered.push(...refs.map((d)=>d.id));
    }
    const [primary, ...rest] = ordered;
    if (!primary) return {
        ok: false,
        error: "no input documents resolved"
    };
    return {
        ok: true,
        primary,
        rest,
        byModule,
        assignment
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/inference-setup-files.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "INFERENCE_SETUP_SUFFIX",
    ()=>INFERENCE_SETUP_SUFFIX,
    "inferenceSetupSkeleton",
    ()=>inferenceSetupSkeleton,
    "inputModulesOf",
    ()=>inputModulesOf,
    "isInferenceSetupFileName",
    ()=>isInferenceSetupFileName,
    "nextInferenceSetupFileName",
    ()=>nextInferenceSetupFileName,
    "parseInferenceSetupFile",
    ()=>parseInferenceSetupFile,
    "resolveInferenceSetupInputs",
    ()=>resolveInferenceSetupInputs,
    "setupDisplayName",
    ()=>setupDisplayName,
    "validateInferenceSetupFile",
    ()=>validateInferenceSetupFile,
    "validateNamedInputs",
    ()=>validateNamedInputs
]);
// AI : *_inference.json — named input setups for the Inference tab (same inputs shape as *_testing.json).
// AI : validated against the live pipeline since labels and doc names drift.
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$presets$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/inference-presets.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$validity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/inference-validity.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/pipeline_state.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$json$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/json-utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/types.ts [app-client] (ecmascript) <locals>");
;
;
;
;
;
const INFERENCE_SETUP_SUFFIX = "_inference.json";
function isInferenceSetupFileName(name) {
    return name.toLowerCase().endsWith(INFERENCE_SETUP_SUFFIX);
}
function parseInferenceSetupFile(content) {
    const parsed = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$json$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tryParseJson"])(content, {
        trim: true
    });
    if (!parsed.ok) return {
        ok: false,
        error: `invalid json: ${parsed.error.message}`
    };
    const value = parsed.value;
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return {
            ok: false,
            error: "setup file must be a JSON object"
        };
    }
    const obj = value;
    const inputs = obj.inputs;
    if (inputs === null || typeof inputs !== "object" || Array.isArray(inputs)) {
        return {
            ok: false,
            error: 'missing "inputs" object (input step label → doc name)'
        };
    }
    return {
        ok: true,
        setup: {
            description: typeof obj.description === "string" ? obj.description : undefined,
            inputs: inputs
        }
    };
}
function moduleByLabel(modules, label) {
    return modules.find((m)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(m.label) === (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(label));
}
function inputModulesOf(modules) {
    return modules.filter((m)=>m.kind === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ModuleKind"].Input);
}
const docNames = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$presets$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["namedInputDocNames"];
function validateNamedInputs(inputs, project, projectDocs) {
    const issues = [];
    const modules = project.modules;
    for (const [label, value] of Object.entries(inputs)){
        const mod = moduleByLabel(modules, label);
        if (!mod) {
            issues.push({
                level: "error",
                where: label,
                message: "input step not found in the pipeline"
            });
            continue;
        }
        if (mod.kind !== __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ModuleKind"].Input) {
            issues.push({
                level: "error",
                where: label,
                message: `"${label}" is a ${mod.kind} step, not an input`
            });
            continue;
        }
        const names = docNames(value);
        if (!names.length) {
            issues.push({
                level: "warning",
                where: label,
                message: "no document name set for this input"
            });
        }
        for (const name of names){
            const doc = projectDocs.find((d)=>d.name === name);
            if (!doc) {
                issues.push({
                    level: "error",
                    where: label,
                    message: `document "${name}" not found in this project`
                });
                continue;
            }
            const assignmentIssue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$validity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateInferenceDocAssignment"])(mod, doc);
            if (assignmentIssue) {
                issues.push({
                    level: "error",
                    where: label,
                    message: `${name}: ${assignmentIssue.message}`
                });
            }
        }
    }
    for (const m of inputModulesOf(modules)){
        if (!((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(m.label) in inputs) && !Object.keys(inputs).some((l)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(l) === (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(m.label))) {
            issues.push({
                level: "warning",
                where: m.label,
                message: "input step has no document assigned — assign one before running"
            });
        }
    }
    return issues;
}
function validateInferenceSetupFile(setup, project, projectDocs) {
    return validateNamedInputs(setup.inputs ?? {}, project, projectDocs);
}
function resolveInferenceSetupInputs(setup, modules, projectDocs) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$presets$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveNamedRunInputs"])(setup.inputs ?? {}, modules, projectDocs);
}
function inferenceSetupSkeleton(project) {
    const inputs = {};
    for (const m of inputModulesOf(project.modules)){
        inputs[(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(m.label)] = "";
    }
    const skeleton = {
        description: "Describe this run setup",
        inputs
    };
    return JSON.stringify(skeleton, null, 2);
}
function nextInferenceSetupFileName(existing) {
    const taken = new Set(existing.map((d)=>d.name));
    for(let n = 1;; n++){
        const name = `setup_${n}${INFERENCE_SETUP_SUFFIX}`;
        if (!taken.has(name)) return name;
    }
}
function setupDisplayName(docName) {
    return docName.endsWith(INFERENCE_SETUP_SUFFIX) ? docName.slice(0, -INFERENCE_SETUP_SUFFIX.length) || docName : docName;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/testing-files.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TESTING_FILE_SUFFIX",
    ()=>TESTING_FILE_SUFFIX,
    "analyzeTestPipelineAlignment",
    ()=>analyzeTestPipelineAlignment,
    "buildTestCoverageMap",
    ()=>buildTestCoverageMap,
    "compareRunToTest",
    ()=>compareRunToTest,
    "deterministicCompareCores",
    ()=>deterministicCompareCores,
    "deterministicDiffEvalPayloads",
    ()=>deterministicDiffEvalPayloads,
    "diffExplanationMap",
    ()=>diffExplanationMap,
    "firstFailure",
    ()=>firstFailure,
    "inputModulesOf",
    ()=>inputModulesOf,
    "isComparableStep",
    ()=>isComparableStep,
    "isProbabilisticFieldPath",
    ()=>isProbabilisticFieldPath,
    "isProbabilisticReferenceValue",
    ()=>isProbabilisticReferenceValue,
    "isTestingFileName",
    ()=>isTestingFileName,
    "isTolerantFieldPath",
    ()=>isTolerantFieldPath,
    "lastTestRunVerdictForDoc",
    ()=>lastTestRunVerdictForDoc,
    "latestTestVerdictForDoc",
    ()=>latestTestVerdictForDoc,
    "mergeDeterministicDiffExplanations",
    ()=>mergeDeterministicDiffExplanations,
    "mergeInputDescriptionChecks",
    ()=>mergeInputDescriptionChecks,
    "mergeProbabilisticEvaluations",
    ()=>mergeProbabilisticEvaluations,
    "nextTestFileName",
    ()=>nextTestFileName,
    "normalizeFieldPath",
    ()=>normalizeFieldPath,
    "parseTestFile",
    ()=>parseTestFile,
    "probabilisticEvalPayloads",
    ()=>probabilisticEvalPayloads,
    "probabilisticFieldPairs",
    ()=>probabilisticFieldPairs,
    "probabilisticPathsForModule",
    ()=>probabilisticPathsForModule,
    "probabilisticReferencePaths",
    ()=>probabilisticReferencePaths,
    "remapCandidatesForExpectedValue",
    ()=>remapCandidatesForExpectedValue,
    "resolveTestRunInputs",
    ()=>resolveTestRunInputs,
    "sanitizeTestFile",
    ()=>sanitizeTestFile,
    "skipReasonForTestStep",
    ()=>skipReasonForTestStep,
    "testContentSig",
    ()=>testContentSig,
    "testContentStableSig",
    ()=>testContentStableSig,
    "testFileSkeleton",
    ()=>testFileSkeleton,
    "testPipelineSig",
    ()=>testPipelineSig,
    "testPipelineStableSig",
    ()=>testPipelineStableSig,
    "testReportMatchesSigs",
    ()=>testReportMatchesSigs,
    "testRunContextSig",
    ()=>testRunContextSig,
    "testRunContextStableSig",
    ()=>testRunContextStableSig,
    "testRunHistoryForDoc",
    ()=>testRunHistoryForDoc,
    "testVerdictPassed",
    ()=>testVerdictPassed,
    "toleranceForFieldPath",
    ()=>toleranceForFieldPath,
    "tolerantPathsForModule",
    ()=>tolerantPathsForModule,
    "validateTestFile",
    ()=>validateTestFile
]);
// AI : *_testing.json format — per-step expected outputs to pinpoint where a pipeline diverges.
// AI : validated against the live pipeline (labels + spine output types) since pipelines drift.
// AI : TODO (spec) — test verdict expiry (~7d) in Supabase keyed on testContentSig + pipelineSig; revert restores cached pass/fail.
// AI : TODO (spec) — confusion matrices / field group-by mapping in test compare UI (spec § testing).
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$schema$2d$form$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/schema-form.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$step$2d$json$2d$schema$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/step-json-schema.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$deep_equal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/deep_equal.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$json$2d$diff$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/json-diff.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$presets$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/inference-presets.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$setup$2d$files$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/inference-setup-files.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/pipeline_state.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/type_expr.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$json$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/json-utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$run$2d$fingerprint$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/run-fingerprint.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/types.ts [app-client] (ecmascript) <locals>");
;
;
;
;
;
;
;
;
;
;
;
const TESTING_FILE_SUFFIX = "_testing.json";
function isTestingFileName(name) {
    return name.toLowerCase().endsWith(TESTING_FILE_SUFFIX);
}
function parseTestFile(content) {
    const parsed = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$json$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tryParseJson"])(content, {
        trim: true
    });
    if (!parsed.ok) return {
        ok: false,
        error: `invalid json: ${parsed.error.message}`
    };
    const value = parsed.value;
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return {
            ok: false,
            error: "test file must be a JSON object"
        };
    }
    const obj = value;
    const expected = obj.expectedOutputs;
    if (expected === null || typeof expected !== "object" || Array.isArray(expected)) {
        return {
            ok: false,
            error: 'missing "expectedOutputs" object (step label → expected value)'
        };
    }
    const inputs = obj.inputs;
    if (inputs !== undefined && (inputs === null || typeof inputs !== "object" || Array.isArray(inputs))) {
        return {
            ok: false,
            error: '"inputs" must be an object (input step label → doc name)'
        };
    }
    return {
        ok: true,
        test: {
            description: typeof obj.description === "string" ? obj.description : undefined,
            inputs: inputs,
            expectedOutputs: expected
        }
    };
}
function moduleByLabel(modules, label) {
    return modules.find((m)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(m.label) === (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(label));
}
function inputModulesOf(modules) {
    return modules.filter((m)=>m.kind === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ModuleKind"].Input);
}
function isComparableStep(m) {
    return m.kind !== __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ModuleKind"].Input && m.kind !== __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ModuleKind"].Combine;
}
function skipReasonForTestStep(m) {
    if (m.kind === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ModuleKind"].Input) return "Input — no computation";
    if (m.kind === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ModuleKind"].Combine) return "Combine — input checked, output not scored";
    return undefined;
}
function sanitizeTestFile(test, project) {
    const expectedOutputs = {};
    for (const [label, value] of Object.entries(test.expectedOutputs)){
        const mod = moduleByLabel(project.modules, label);
        if (!mod || !isComparableStep(mod)) continue;
        expectedOutputs[(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(label)] = value;
    }
    const inputs = {
        ...test.inputs ?? {}
    };
    for (const m of inputModulesOf(project.modules)){
        const key = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(m.label);
        if (key in inputs) continue;
        inputs[key] = "";
    }
    return {
        ...test,
        inputs,
        expectedOutputs
    };
}
function validateTestFile(test, project, projectDocs) {
    const issues = [];
    const modules = project.modules;
    test = sanitizeTestFile(test, project);
    const expectedEntries = Object.entries(test.expectedOutputs);
    if (!expectedEntries.length) {
        issues.push({
            level: "error",
            where: "expectedOutputs",
            message: "no expected outputs defined"
        });
    }
    for (const [label, value] of expectedEntries){
        const mod = moduleByLabel(modules, label);
        if (!mod) {
            issues.push({
                level: "error",
                where: label,
                message: "step no longer exists in the pipeline — update this test"
            });
            continue;
        }
        if (value === null) {
            issues.push({
                level: "warning",
                where: label,
                message: "placeholder — fill in the expected output"
            });
            continue;
        }
        const schema = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$step$2d$json$2d$schema$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["stepOutputJsonSchema"])(project, label);
        const root = schema ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$schema$2d$form$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsonSchemaToFormRoot"])(schema) : null;
        const normalized = root ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$schema$2d$form$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["applySchemaDefaults"])(value, root) : value;
        const check = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validatePipelineStateEntry"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(label), normalized, project);
        if (!check.ok) {
            issues.push({
                level: "error",
                where: label,
                message: `expected value does not match this step's output type:\n${check.error}`
            });
        }
    }
    issues.push(...(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$setup$2d$files$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateNamedInputs"])(test.inputs ?? {}, project, projectDocs));
    return issues;
}
function trackedExpectedKeys(expectedOutputs) {
    return new Set(Object.keys(expectedOutputs).map(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"]));
}
function remapCandidatesForExpectedValue(expectedValue, expectedOutputs, project) {
    const tracked = trackedExpectedKeys(expectedOutputs);
    const candidates = [];
    for (const m of project.modules){
        if (!isComparableStep(m)) continue;
        const key = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(m.label);
        if (tracked.has(key)) continue;
        if (expectedValue === null) {
            candidates.push(key);
            continue;
        }
        const check = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validatePipelineStateEntry"])(key, expectedValue, project);
        if (check.ok) candidates.push(key);
    }
    return candidates;
}
function remapCandidatesForOrphanInput(orphanLabel, inputs, project) {
    const used = new Set(Object.keys(inputs ?? {}).map(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"]));
    used.delete((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(orphanLabel));
    return inputModulesOf(project.modules).map((m)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(m.label)).filter((key)=>!used.has(key));
}
function analyzeTestPipelineAlignment(test, project) {
    const sanitized = sanitizeTestFile({
        expectedOutputs: test.expectedOutputs,
        inputs: test.inputs
    }, project);
    const tracked = trackedExpectedKeys(sanitized.expectedOutputs);
    const stepRows = project.modules.map((module)=>{
        const key = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(module.label);
        let trackStatus;
        if (module.kind === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ModuleKind"].Input) trackStatus = "input";
        else if (!isComparableStep(module)) trackStatus = "passthrough";
        else if (tracked.has(key)) trackStatus = "tracked";
        else trackStatus = "untracked";
        return {
            module,
            trackStatus
        };
    });
    const orphanedExpected = [];
    for (const [label, value] of Object.entries(test.expectedOutputs)){
        const mod = moduleByLabel(project.modules, label);
        if (mod) continue;
        orphanedExpected.push({
            label: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(label),
            remapCandidates: remapCandidatesForExpectedValue(value, sanitized.expectedOutputs, project)
        });
    }
    const orphanedInputs = Object.keys(sanitized.inputs ?? {}).filter((label)=>!inputModulesOf(project.modules).some((m)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(m.label) === (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(label))).map((label)=>({
            label: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(label),
            remapCandidates: remapCandidatesForOrphanInput(label, test.inputs, project)
        }));
    return {
        stepRows,
        orphanedExpected,
        orphanedInputs
    };
}
function buildTestCoverageMap(alignment) {
    const out = new Map();
    for (const { module, trackStatus } of alignment.stepRows)out.set(module.id, trackStatus);
    return out;
}
function resolveTestRunInputs(test, modules, projectDocs) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$presets$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveNamedRunInputs"])(test.inputs ?? {}, modules, projectDocs);
}
// AI : per-step input guard — same rule as run engine (lib/server/input_description_check.ts).
function stepChecksInputDescription(m) {
    if (!m.inputDescription?.trim()) return false;
    return m.checkInputDescription !== false;
}
function orderTestResultsByPipeline(results, modules) {
    const byKey = new Map(results.map((r)=>[
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(r.label),
            r
        ]));
    const ordered = [];
    const seen = new Set();
    for (const m of modules){
        const key = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(m.label);
        const row = byKey.get(key);
        if (!row) continue;
        ordered.push(row);
        seen.add(key);
    }
    for (const r of results){
        const key = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(r.label);
        if (!seen.has(key)) ordered.push(r);
    }
    return ordered;
}
function mergeInputDescriptionChecks(run, results, project) {
    const byKey = new Map(results.map((r)=>[
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(r.label),
            {
                ...r
            }
        ]));
    for (const m of project.modules){
        if (!stepChecksInputDescription(m)) continue;
        const key = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(m.label);
        const step = run.steps.find((s)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(s.label) === key);
        const check = step?.inputDescriptionCheck;
        if (!check) continue;
        const existing = byKey.get(key);
        if (check.matches === false) {
            byKey.set(key, {
                label: m.label,
                status: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["RunTestStepStatus"].Fail,
                inputDescriptionCheck: check,
                skipReason: existing?.skipReason ?? skipReasonForTestStep(m),
                expected: existing?.expected,
                actual: existing?.actual,
                diffPath: existing?.diffPath,
                deterministicDiff: existing?.deterministicDiff,
                deterministicDiffExplanations: existing?.deterministicDiffExplanations,
                ignoredPaths: existing?.ignoredPaths,
                tolerantPaths: existing?.tolerantPaths,
                probabilisticResults: existing?.probabilisticResults,
                llmEvaluated: existing?.llmEvaluated
            });
            continue;
        }
        if (existing) {
            byKey.set(key, {
                ...existing,
                inputDescriptionCheck: check
            });
            continue;
        }
        byKey.set(key, {
            label: m.label,
            status: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["RunTestStepStatus"].Skipped,
            skipReason: skipReasonForTestStep(m) ?? "input checked — not scored",
            inputDescriptionCheck: check
        });
    }
    return orderTestResultsByPipeline([
        ...byKey.values()
    ], project.modules);
}
// AI : golden fixtures use seed doc_ids; runs use content hashes — drop for skipped-step display.
function stripDocIds(value) {
    if (Array.isArray(value)) return value.map(stripDocIds);
    if (value !== null && typeof value === "object") {
        const out = {};
        for (const [k, v] of Object.entries(value)){
            if (k === "doc_id") continue;
            out[k] = stripDocIds(v);
        }
        return out;
    }
    return value;
}
// AI : static walk of a type — every field path whose structure definition says
// AI : deterministic:false (probabilistic — LLM prose that varies per run), e.g. "[].mistake_explanation".
function isNumericField(f) {
    if (f.deterministic === false) return false;
    const expr = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fieldToTypeExpr"])(f);
    return expr.kind === "prim" && (expr.name === "int" || expr.name === "float");
}
function collectProbabilisticPaths(expr, models, path, seen, out) {
    if (!expr) return;
    switch(expr.kind){
        case "optional":
            return collectProbabilisticPaths(expr.inner, models, path, seen, out);
        case "list":
        case "set":
            return collectProbabilisticPaths(expr.item, models, `${path}[]`, seen, out);
        case "ref":
            {
                if (seen.has(expr.modelId)) return;
                const model = models.find((m)=>m.id === expr.modelId);
                if (!model) return;
                for (const f of model.fields){
                    const childPath = path ? `${path}.${f.name}` : f.name;
                    if (f.deterministic === false) out.add(childPath);
                    else {
                        collectProbabilisticPaths((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fieldToTypeExpr"])(f), models, childPath, new Set([
                            ...seen,
                            expr.modelId
                        ]), out);
                    }
                }
                return;
            }
        default:
            return;
    }
}
// AI : int/float fields with testTolerance — compared with ± in tests, not LLM-checked.
function collectTolerantPaths(expr, models, path, seen, out) {
    if (!expr) return;
    switch(expr.kind){
        case "optional":
            return collectTolerantPaths(expr.inner, models, path, seen, out);
        case "list":
        case "set":
            return collectTolerantPaths(expr.item, models, `${path}[]`, seen, out);
        case "ref":
            {
                if (seen.has(expr.modelId)) return;
                const model = models.find((m)=>m.id === expr.modelId);
                if (!model) return;
                for (const f of model.fields){
                    const childPath = path ? `${path}.${f.name}` : f.name;
                    if (f.deterministic === false) continue;
                    if (isNumericField(f) && f.testTolerance !== undefined && Number.isFinite(f.testTolerance) && f.testTolerance >= 0) {
                        out.set(childPath, f.testTolerance);
                        continue;
                    }
                    collectTolerantPaths((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fieldToTypeExpr"])(f), models, childPath, new Set([
                        ...seen,
                        expr.modelId
                    ]), out);
                }
                return;
            }
        default:
            return;
    }
}
function probabilisticPathsForModule(m, models) {
    const out = new Set();
    collectProbabilisticPaths((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["stepSpineOutType"])(m), models, "", new Set(), out);
    return [
        ...out
    ].sort();
}
function tolerantPathsForModule(m, models) {
    const out = new Map();
    collectTolerantPaths((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["stepSpineOutType"])(m), models, "", new Set(), out);
    return [
        ...out.entries()
    ].sort(([a], [b])=>a.localeCompare(b)).map(([path, tolerance])=>({
            path,
            tolerance
        }));
}
function toleranceForFieldPath(path, tolerantPaths) {
    const norm = normalizeFieldPath(path);
    return tolerantPaths.find((t)=>normalizeFieldPath(t.path) === norm)?.tolerance;
}
function isTolerantFieldPath(path, tolerantPaths) {
    return toleranceForFieldPath(path, tolerantPaths) !== undefined;
}
function normalizeFieldPath(path) {
    return path.replace(/\[\d+\]/g, "[]");
}
function isProbabilisticFieldPath(path, probabilisticPaths) {
    if (!path) return false;
    const norm = normalizeFieldPath(path);
    return probabilisticPaths.some((p)=>normalizeFieldPath(p) === norm);
}
// AI : structural walk mirroring the path grammar above — array items normalize to "[]",
// AI : so a value path can be matched against the static probabilistic paths and dropped.
function stripPaths(value, paths, path) {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map((v)=>stripPaths(v, paths, `${path}[]`));
    const out = {};
    for (const [k, v] of Object.entries(value)){
        const childPath = path ? `${path}.${k}` : k;
        if (paths.has(childPath)) continue;
        out[k] = stripPaths(v, paths, childPath);
    }
    return out;
}
// AI : collect every concrete value at probabilistic paths — e.g. "[].feedback" → "[0].feedback", …
function collectPathValues(value, pattern, currentPath) {
    if (!pattern) return [
        {
            path: currentPath || "(root)",
            value
        }
    ];
    if (pattern.startsWith("[]")) {
        if (!Array.isArray(value)) return [];
        const rest = pattern.slice(2).replace(/^\./, "");
        return value.flatMap((item, i)=>collectPathValues(item, rest, currentPath ? `${currentPath}[${i}]` : `[${i}]`));
    }
    const dot = pattern.indexOf(".");
    const key = dot === -1 ? pattern : pattern.slice(0, dot);
    const rest = dot === -1 ? "" : pattern.slice(dot + 1);
    if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
    const obj = value;
    if (!(key in obj)) return [];
    const childPath = currentPath ? `${currentPath}.${key}` : key;
    return collectPathValues(obj[key], rest, childPath);
}
function isProbabilisticReferenceValue(value) {
    return value !== null && value !== undefined && value !== "";
}
function probabilisticReferencePaths(expected, paths) {
    const out = [];
    for (const pattern of paths){
        for (const { path, value } of collectPathValues(expected, pattern, "")){
            if (isProbabilisticReferenceValue(value)) out.push(path);
        }
    }
    return out;
}
function probabilisticFieldPairs(expected, actual, paths) {
    const out = [];
    for (const pattern of paths){
        const expVals = collectPathValues(expected, pattern, "");
        const actVals = collectPathValues(actual, pattern, "");
        const actByPath = new Map(actVals.map((v)=>[
                v.path,
                v.value
            ]));
        for (const { path, value: exp } of expVals){
            if (!isProbabilisticReferenceValue(exp)) continue;
            out.push({
                path,
                expected: exp,
                actual: actByPath.get(path)
            });
        }
    }
    return out;
}
function mergeProbabilisticEvaluations(results, evaluations) {
    const evalByKey = new Map(evaluations.map((e)=>[
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(e.label),
            e
        ]));
    return results.map((r)=>{
        const ev = evalByKey.get((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(r.label));
        if (!ev || r.status !== __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["RunTestStepStatus"].Pass) return r;
        const probabilisticPass = ev.fieldResults.every((x)=>x.pass);
        return {
            ...r,
            status: probabilisticPass ? __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["RunTestStepStatus"].Pass : __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["RunTestStepStatus"].Fail,
            probabilisticResults: ev.fieldResults,
            llmEvaluated: true
        };
    });
}
function probabilisticEvalPayloads(run, test, deterministicResults, project) {
    const expectedByKey = new Map(Object.entries(test.expectedOutputs).map(([label, v])=>[
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(label),
            v
        ]));
    const out = [];
    for (const r of deterministicResults){
        if (r.status !== __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["RunTestStepStatus"].Pass || !r.ignoredPaths?.length) continue;
        const m = project.modules.find((mod)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(mod.label) === (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(r.label));
        if (!m) continue;
        const expected = expectedByKey.get((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(r.label));
        const step = run.steps.find((s)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(s.label) === (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(r.label));
        const parsed = step?.outputJson ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$json$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tryParseJson"])(step.outputJson) : null;
        const actual = parsed?.ok ? parsed.value : r.actual;
        if (expected === undefined || actual === undefined) continue;
        const fields = probabilisticFieldPairs(expected, actual, r.ignoredPaths);
        if (fields.length) out.push({
            label: r.label,
            fields
        });
    }
    return out;
}
const MAX_DETERMINISTIC_DIFF_FIELDS = 50;
function deterministicCoreCompareOpts(r) {
    if (!r.tolerantPaths?.length) return undefined;
    return {
        tolerantByPattern: new Map(r.tolerantPaths.map((t)=>[
                t.path,
                t.tolerance
            ]))
    };
}
function deterministicDiffFieldsForResult(r) {
    if (r.expected === undefined || r.actual === undefined) return [];
    const pathSet = new Set(r.ignoredPaths ?? []);
    const expectedCore = stripPaths(r.expected, pathSet, "");
    const actualCore = stripPaths(r.actual, pathSet, "");
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$deep_equal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collectTestDiffFields"])(expectedCore, actualCore, deterministicCoreCompareOpts(r)).slice(0, MAX_DETERMINISTIC_DIFF_FIELDS);
}
function deterministicDiffEvalPayloads(results) {
    const out = [];
    for (const r of results){
        if (r.status !== __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["RunTestStepStatus"].Fail || !r.deterministicDiff) continue;
        const fields = deterministicDiffFieldsForResult(r);
        if (!fields.length) continue;
        out.push({
            label: r.label,
            fields,
            tolerantPaths: r.tolerantPaths
        });
    }
    return out;
}
function mergeDeterministicDiffExplanations(results, evaluations) {
    const evalByKey = new Map(evaluations.map((e)=>[
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(e.label),
            e
        ]));
    return results.map((r)=>{
        const ev = evalByKey.get((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(r.label));
        if (!ev?.fieldResults.length) return r;
        return {
            ...r,
            deterministicDiffExplanations: ev.fieldResults
        };
    });
}
function diffExplanationMap(explanations) {
    const out = new Map();
    for (const row of explanations ?? []){
        if (row.path && row.reason) out.set(row.path, row.reason);
    }
    return out;
}
function deterministicCompareCores(expected, actual, ignoredPaths) {
    const pathSet = new Set(ignoredPaths ?? []);
    return {
        expectedCore: stripPaths(expected, pathSet, ""),
        actualCore: stripPaths(actual, pathSet, "")
    };
}
function compareRunToTest(run, test, project) {
    const expectedByKey = new Map(Object.entries(test.expectedOutputs).map(([label, v])=>[
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(label),
            v
        ]));
    const results = [];
    for (const m of project.modules){
        const key = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(m.label);
        if (!expectedByKey.has(key)) continue;
        const expected = expectedByKey.get(key);
        const step = run.steps.find((s)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(s.label) === key);
        if (!step || step.outputJson === undefined) {
            results.push({
                label: m.label,
                status: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["RunTestStepStatus"].NotReached,
                expected
            });
            continue;
        }
        const parsed = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$json$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tryParseJson"])(step.outputJson);
        const actual = parsed.ok ? parsed.value : step.outputJson;
        if (!isComparableStep(m)) {
            results.push({
                label: m.label,
                status: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["RunTestStepStatus"].Skipped,
                skipReason: skipReasonForTestStep(m),
                expected: stripDocIds(expected),
                actual: actual === undefined ? undefined : stripDocIds(actual)
            });
            continue;
        }
        const probabilistic = probabilisticPathsForModule(m, project.models);
        const ignoredPaths = probabilistic.length ? probabilistic : undefined;
        const tolerant = tolerantPathsForModule(m, project.models);
        const tolerantPaths = tolerant.length ? tolerant : undefined;
        const pathSet = new Set(probabilistic);
        const expectedCore = stripPaths(expected, pathSet, "");
        const actualCore = stripPaths(actual, pathSet, "");
        const compareOpts = {
            tolerantByPattern: tolerant.length ? new Map(tolerant.map((t)=>[
                    t.path,
                    t.tolerance
                ])) : undefined
        };
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$deep_equal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["testValuesEqual"])(actualCore, expectedCore, compareOpts)) {
            results.push({
                label: m.label,
                status: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["RunTestStepStatus"].Pass,
                ignoredPaths,
                tolerantPaths,
                expected,
                actual
            });
        } else {
            results.push({
                label: m.label,
                status: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["RunTestStepStatus"].Fail,
                diffPath: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$deep_equal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["testValuesDiffPath"])(actualCore, expectedCore, compareOpts),
                deterministicDiff: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$json$2d$diff$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsonUnifiedDiff"])(expectedCore, actualCore),
                ignoredPaths,
                tolerantPaths,
                expected,
                actual
            });
        }
    }
    return results;
}
function firstFailure(results) {
    return results.find((r)=>r.status === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["RunTestStepStatus"].Fail || r.status === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["RunTestStepStatus"].NotReached || r.inputDescriptionCheck?.matches === false);
}
function testVerdictPassed(results) {
    return firstFailure(results) === undefined;
}
function testContentPayload(content) {
    const parsed = parseTestFile(content);
    if (parsed.ok) return parsed.test;
    return {
        raw: content
    };
}
function pipelinePayload(project, model, pipeline) {
    const p = pipeline ? {
        ...project,
        modules: pipeline.modules,
        models: pipeline.models,
        typeAliases: pipeline.typeAliases
    } : project;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$run$2d$fingerprint$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["buildRunConfigPayload"])(p, model);
}
function runContextPayload(content, project, model, pipeline) {
    return {
        pipeline: pipelinePayload(project, model, pipeline),
        content
    };
}
function testContentSig(content) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$run$2d$fingerprint$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["hashStableJson"])(testContentPayload(content));
}
function testContentStableSig(content) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$run$2d$fingerprint$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["stableJson"])(testContentPayload(content));
}
function testPipelineSig(project, model, pipeline) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$run$2d$fingerprint$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["hashStableJson"])(pipelinePayload(project, model, pipeline));
}
function testPipelineStableSig(project, model, pipeline) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$run$2d$fingerprint$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["stableJson"])(pipelinePayload(project, model, pipeline));
}
function testRunContextSig(content, project, model, pipeline) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$run$2d$fingerprint$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["hashStableJson"])(runContextPayload(content, project, model, pipeline));
}
function testRunContextStableSig(content, project, model, pipeline) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$run$2d$fingerprint$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["stableJson"])(runContextPayload(content, project, model, pipeline));
}
function sigMatches(stored, hash, stable) {
    if (!stored) return false;
    if (stored === hash) return true;
    // AI : legacy runs persisted full stableJson before hash sigs were introduced.
    return !!stable && stored === stable;
}
function testReportMatchesSigs(report, testContentSig, pipelineSig, legacy) {
    if (report.testContentSig !== undefined && report.pipelineSig !== undefined) {
        return sigMatches(report.testContentSig, testContentSig, legacy?.contentStable) && sigMatches(report.pipelineSig, pipelineSig, legacy?.pipelineStable);
    }
    if (report.contextSig && legacy?.combinedStable) {
        return report.contextSig === legacy.combinedStable;
    }
    return false;
}
function latestTestVerdictForDoc(runs, testDocName, testContentSig, pipelineSig, legacy) {
    let latest;
    for (const r of runs){
        if (r.source !== __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["RunSource"].Testing || r.test?.testDocName !== testDocName) continue;
        if (!testReportMatchesSigs(r.test, testContentSig, pipelineSig, legacy)) continue;
        if (!latest || r.startedAt > latest.startedAt) latest = r;
    }
    if (!latest?.test) return null;
    return testVerdictPassed(latest.test.results);
}
function testRunHistoryForDoc(runs, testDocName) {
    return runs.filter((r)=>r.source === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["RunSource"].Testing && r.test?.testDocName === testDocName).sort((a, b)=>b.startedAt - a.startedAt);
}
function lastTestRunVerdictForDoc(runs, testDocName) {
    const latest = testRunHistoryForDoc(runs, testDocName)[0];
    if (!latest?.test) return null;
    return testVerdictPassed(latest.test.results);
}
function testFileSkeleton(project, projectDocs) {
    const inputs = {};
    for (const m of inputModulesOf(project.modules)){
        const candidate = projectDocs.find((d)=>d.label === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["DocLabel"].Inference && !isTestingFileName(d.name) && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$setup$2d$files$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isInferenceSetupFileName"])(d.name));
        inputs[(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(m.label)] = candidate?.name ?? "";
    }
    const golden = project.expectedOutputs ?? {};
    const expectedOutputs = {};
    for (const m of project.modules){
        if (m.kind === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ModuleKind"].Input || m.kind === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ModuleKind"].Combine) continue;
        const key = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(m.label);
        if (!key) continue;
        if (key in golden) expectedOutputs[key] = golden[key];
    }
    if (!Object.keys(expectedOutputs).length) {
        for (const m of project.modules){
            if (m.kind !== __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ModuleKind"].Output) continue;
            const key = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pipeline_state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelAsStateKey"])(m.label);
            if (key) expectedOutputs[key] = null;
        }
    }
    const skeleton = {
        description: "Describe what this test checks",
        inputs,
        expectedOutputs
    };
    return JSON.stringify(skeleton, null, 2);
}
function nextTestFileName(existing) {
    const taken = new Set(existing.map((d)=>d.name));
    for(let n = 1;; n++){
        const name = `test_${n}${TESTING_FILE_SUFFIX}`;
        if (!taken.has(name)) return name;
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/json-pretty-lines.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "assignPathsToPrettyLines",
    ()=>assignPathsToPrettyLines,
    "differingDeterministicPrettyLineIndexes",
    ()=>differingDeterministicPrettyLineIndexes,
    "differingPrettyLineIndexes",
    ()=>differingPrettyLineIndexes,
    "prettyJsonLineCompareComment",
    ()=>prettyJsonLineCompareComment,
    "valueAtJsonPath",
    ()=>valueAtJsonPath
]);
// AI : map pretty-printed JSON lines to field paths for per-line compare highlighting.
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$testing$2d$files$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/testing-files.ts [app-client] (ecmascript)");
;
const KEY_VALUE_LINE_RE = /^"((?:\\.|[^"\\])*)"\s*:\s*(.*?)(,?)$/;
function parentObjectPath(stack) {
    for(let i = stack.length - 1; i >= 0; i--){
        if (stack[i].kind === "object") return stack[i].path;
    }
    return "";
}
function arrayElementPath(frame) {
    return frame.path ? `${frame.path}[${frame.nextIndex}]` : `[${frame.nextIndex}]`;
}
function assignPathsToPrettyLines(lines) {
    const paths = lines.map(()=>undefined);
    const stack = [];
    for(let i = 0; i < lines.length; i++){
        const t = lines[i].trim();
        if (t === "{") {
            const top = stack[stack.length - 1];
            // AI : pretty-printed array elements often put "{" on its own line — bind object frame here.
            if (top?.kind === "array") {
                const elemPath = arrayElementPath(top);
                stack.push({
                    kind: "object",
                    path: elemPath
                });
                top.nextIndex++;
            }
            continue;
        }
        if (t === "[") {
            const top = stack[stack.length - 1];
            if (!stack.length) {
                stack.push({
                    kind: "array",
                    path: "",
                    nextIndex: 0
                });
            } else if (top?.kind === "array") {
                const elemPath = arrayElementPath(top);
                stack.push({
                    kind: "array",
                    path: elemPath,
                    nextIndex: 0
                });
                top.nextIndex++;
            }
            continue;
        }
        if (t === "}" || t === "}," || t === "]" || t === "],") {
            stack.pop();
            continue;
        }
        const keyVal = t.match(KEY_VALUE_LINE_RE);
        if (keyVal) {
            const key = JSON.parse(`"${keyVal[1]}"`);
            const parentPath = parentObjectPath(stack);
            const fieldPath = parentPath ? `${parentPath}.${key}` : key;
            const rest = keyVal[2].trim();
            if (rest === "{") stack.push({
                kind: "object",
                path: fieldPath
            });
            else if (rest === "[") stack.push({
                kind: "array",
                path: fieldPath,
                nextIndex: 0
            });
            else paths[i] = fieldPath;
            continue;
        }
        const top = stack[stack.length - 1];
        if (top?.kind !== "array") continue;
        const elemPath = arrayElementPath(top);
        const elem = t.replace(/,$/, "").trim();
        top.nextIndex++;
        if (elem === "{") stack.push({
            kind: "object",
            path: elemPath
        });
        else if (elem === "[") stack.push({
            kind: "array",
            path: elemPath,
            nextIndex: 0
        });
        else paths[i] = elemPath;
    }
    return paths;
}
const PATH_TOKEN_RE = /(\[[^\]]+\]|[^.\[\]]+)/g;
function valueAtJsonPath(root, path) {
    if (!path) return root;
    const tokens = path.match(PATH_TOKEN_RE) ?? [];
    let cur = root;
    for (const tok of tokens){
        if (tok.startsWith("[")) {
            const idx = Number(tok.slice(1, -1));
            if (!Array.isArray(cur)) return undefined;
            cur = cur[idx];
            continue;
        }
        if (cur === null || typeof cur !== "object" || Array.isArray(cur)) return undefined;
        cur = cur[tok];
    }
    return cur;
}
function differingPrettyLineIndexes(a, b) {
    const left = a.split("\n");
    const right = b.split("\n");
    const out = new Set();
    const n = Math.min(left.length, right.length);
    for(let i = 0; i < n; i++){
        if (left[i] !== right[i]) out.add(i);
    }
    return out;
}
function isEmptyComparableText(value) {
    return value === null || value === undefined || value === "";
}
function numbersWithinTolerance(a, b, tolerance) {
    return Math.abs(a - b) <= tolerance;
}
function differingDeterministicPrettyLineIndexes(expected, actual, expectedPretty, actualPretty, probabilisticPaths, tolerantPaths = []) {
    const left = expectedPretty.split("\n");
    const right = actualPretty.split("\n");
    const paths = assignPathsToPrettyLines(left);
    const out = new Set();
    const n = Math.min(left.length, right.length);
    for(let i = 0; i < n; i++){
        if (left[i] === right[i]) continue;
        const path = paths[i];
        if (path && (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$testing$2d$files$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isProbabilisticFieldPath"])(path, probabilisticPaths)) continue;
        if (path && (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$testing$2d$files$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTolerantFieldPath"])(path, tolerantPaths)) {
            const ev = valueAtJsonPath(expected, path);
            const av = valueAtJsonPath(actual, path);
            const tol = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$testing$2d$files$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toleranceForFieldPath"])(path, tolerantPaths);
            if (tol !== undefined && typeof ev === "number" && typeof av === "number" && numbersWithinTolerance(ev, av, tol)) {
                continue;
            }
        }
        if (path) {
            const ev = valueAtJsonPath(expected, path);
            const av = valueAtJsonPath(actual, path);
            if (isEmptyComparableText(ev) && isEmptyComparableText(av)) continue;
        }
        out.add(i);
    }
    return out;
}
function prettyJsonLineCompareComment(line) {
    const t = line.trim();
    const keyVal = t.match(KEY_VALUE_LINE_RE);
    if (keyVal) return keyVal[2].trim().replace(/,$/, "");
    return t.replace(/,$/, "");
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/highlight.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "InlineJsonTokens",
    ()=>InlineJsonTokens,
    "JsonFieldKindHighlight",
    ()=>JsonFieldKindHighlight,
    "JsonFieldKindLegend",
    ()=>JsonFieldKindLegend,
    "JsonHighlight",
    ()=>JsonHighlight,
    "MarkdownView",
    ()=>MarkdownView,
    "PromptText",
    ()=>PromptText,
    "ServerLogLineHighlight",
    ()=>ServerLogLineHighlight
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// AI : TODO (spec) — store prompts as JSON components; flatten only when sending to OpenRouter; profile context-length per component.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$link$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Link2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/link-2.mjs [app-client] (ecmascript) <export default as Link2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$markdown$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__Markdown__as__default$3e$__ = __turbopack_context__.i("[project]/node_modules/react-markdown/lib/index.js [app-client] (ecmascript) <export Markdown as default>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$remark$2d$gfm$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/remark-gfm/lib/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$rehype$2d$sanitize$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/rehype-sanitize/lib/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$open$2d$in$2d$documents$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/open-in-documents.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$doc$2d$viewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/doc-viewer.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$deep_equal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/deep_equal.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$json$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/json-utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$json$2d$pretty$2d$lines$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/json-pretty-lines.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$testing$2d$files$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/testing-files.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
;
;
;
const JSON_TOKEN_RE = /("(?:\\.|[^"\\])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
function jsonTokenClass(token) {
    if (/^"/.test(token)) return /:\s*$/.test(token) ? "text-chart-2" : "text-primary";
    if (/^(true|false|null)$/.test(token)) return "text-chart-4";
    if (/^-?\d/.test(token)) return "text-chart-3";
    return "text-foreground";
}
function InlineJsonTokens({ text }) {
    const tokens = (text ?? "").split(JSON_TOKEN_RE);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: tokens.map((t, i)=>t ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: jsonTokenClass(t),
                children: t
            }, i, false, {
                fileName: "[project]/components/highlight.tsx",
                lineNumber: 39,
                columnNumber: 11
            }, this) : null)
    }, void 0, false);
}
_c = InlineJsonTokens;
function JsonHighlight({ json }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
        className: "overflow-x-auto font-mono text-[11px] leading-relaxed",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("code", {
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(InlineJsonTokens, {
                text: json
            }, void 0, false, {
                fileName: "[project]/components/highlight.tsx",
                lineNumber: 53,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 52,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/highlight.tsx",
        lineNumber: 51,
        columnNumber: 5
    }, this);
}
_c1 = JsonHighlight;
const JSON_INDENT = "  ";
function JsonFieldKindLegend() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "inline-flex items-center gap-1.5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "rounded-sm bg-chart-2/15 px-1.5 py-0.5 text-chart-2",
                        children: "="
                    }, void 0, false, {
                        fileName: "[project]/components/highlight.tsx",
                        lineNumber: 68,
                        columnNumber: 9
                    }, this),
                    "deterministic — exact match"
                ]
            }, void 0, true, {
                fileName: "[project]/components/highlight.tsx",
                lineNumber: 67,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "inline-flex items-center gap-1.5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "rounded-sm bg-chart-3/15 px-1.5 py-0.5 text-chart-3",
                        children: "≈"
                    }, void 0, false, {
                        fileName: "[project]/components/highlight.tsx",
                        lineNumber: 72,
                        columnNumber: 9
                    }, this),
                    "probabilistic — LLM-checked"
                ]
            }, void 0, true, {
                fileName: "[project]/components/highlight.tsx",
                lineNumber: 71,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "inline-flex items-center gap-1.5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "rounded-sm bg-output/20 px-1.5 py-0.5 text-output ring-1 ring-output/35",
                        children: "±"
                    }, void 0, false, {
                        fileName: "[project]/components/highlight.tsx",
                        lineNumber: 76,
                        columnNumber: 9
                    }, this),
                    "tolerant — numeric ± compare"
                ]
            }, void 0, true, {
                fileName: "[project]/components/highlight.tsx",
                lineNumber: 75,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "inline-flex items-center gap-1.5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "rounded-sm border border-dashed border-muted-foreground/50 px-1.5 py-0.5 text-muted-foreground",
                        children: "−"
                    }, void 0, false, {
                        fileName: "[project]/components/highlight.tsx",
                        lineNumber: 80,
                        columnNumber: 9
                    }, this),
                    "not checked — reference omitted"
                ]
            }, void 0, true, {
                fileName: "[project]/components/highlight.tsx",
                lineNumber: 79,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/highlight.tsx",
        lineNumber: 66,
        columnNumber: 5
    }, this);
}
_c2 = JsonFieldKindLegend;
function JsonLeafValue({ value, path, probabilisticPaths, probabilisticCheckedPaths, tolerantPaths = [] }) {
    const isProb = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$testing$2d$files$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isProbabilisticFieldPath"])(path, probabilisticPaths);
    const tolerance = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$testing$2d$files$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toleranceForFieldPath"])(path, tolerantPaths);
    const isTolerant = tolerance !== undefined;
    const text = jsonLeafDisplayText(value);
    const llmChecked = isProb ? probabilisticCheckedPaths !== undefined ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$testing$2d$files$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isProbabilisticFieldPath"])(path, probabilisticCheckedPaths) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$testing$2d$files$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isProbabilisticReferenceValue"])(value) : false;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("rounded-sm px-0.5", !isProb && !isTolerant && "bg-chart-2/10", llmChecked && "bg-chart-3/15", isProb && !llmChecked && "border border-dashed border-muted-foreground/40", isTolerant && "bg-output/15 ring-1 ring-output/35"),
        title: isTolerant ? `tolerant — ${text}±${tolerance} (±${tolerance} on int/float compare)` : !isProb ? "deterministic — exact compare" : llmChecked ? "probabilistic — excluded from exact compare, LLM-checked" : "probabilistic — not checked (no expected reference)",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(InlineJsonTokens, {
                text: text
            }, void 0, false, {
                fileName: "[project]/components/highlight.tsx",
                lineNumber: 130,
                columnNumber: 7
            }, this),
            isTolerant && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "font-mono text-[9px] font-semibold text-output",
                children: [
                    "±",
                    tolerance
                ]
            }, void 0, true, {
                fileName: "[project]/components/highlight.tsx",
                lineNumber: 132,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/highlight.tsx",
        lineNumber: 112,
        columnNumber: 5
    }, this);
}
_c3 = JsonLeafValue;
function JsonFieldKindNode({ value, path, probabilisticPaths, probabilisticCheckedPaths, tolerantPaths = [], depth }) {
    const pad = JSON_INDENT.repeat(depth);
    const inner = JSON_INDENT.repeat(depth + 1);
    if (value === null || typeof value !== "object") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(JsonLeafValue, {
            value: value,
            path: path,
            probabilisticPaths: probabilisticPaths,
            probabilisticCheckedPaths: probabilisticCheckedPaths,
            tolerantPaths: tolerantPaths
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 158,
            columnNumber: 7
        }, this);
    }
    if (Array.isArray(value)) {
        if (!value.length) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(InlineJsonTokens, {
            text: "[]"
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 169,
            columnNumber: 31
        }, this);
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                "[\n",
                value.map((item, i)=>{
                    const childPath = path ? `${path}[${i}]` : `[${i}]`;
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: [
                            inner,
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(JsonFieldKindNode, {
                                value: item,
                                path: childPath,
                                probabilisticPaths: probabilisticPaths,
                                probabilisticCheckedPaths: probabilisticCheckedPaths,
                                tolerantPaths: tolerantPaths,
                                depth: depth + 1
                            }, void 0, false, {
                                fileName: "[project]/components/highlight.tsx",
                                lineNumber: 178,
                                columnNumber: 15
                            }, this),
                            i < value.length - 1 ? "," : "",
                            "\n"
                        ]
                    }, i, true, {
                        fileName: "[project]/components/highlight.tsx",
                        lineNumber: 176,
                        columnNumber: 13
                    }, this);
                }),
                pad,
                "]"
            ]
        }, void 0, true);
    }
    const entries = Object.entries(value);
    if (!entries.length) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(InlineJsonTokens, {
        text: "{}"
    }, void 0, false, {
        fileName: "[project]/components/highlight.tsx",
        lineNumber: 198,
        columnNumber: 31
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            "{\n",
            entries.map(([k, v], i)=>{
                const childPath = path ? `${path}.${k}` : k;
                const tol = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$testing$2d$files$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toleranceForFieldPath"])(childPath, tolerantPaths);
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    children: [
                        inner,
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(tol !== undefined ? "text-output" : "text-chart-2"),
                            children: [
                                '"',
                                k,
                                '"'
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/highlight.tsx",
                            lineNumber: 208,
                            columnNumber: 13
                        }, this),
                        ": ",
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(JsonFieldKindNode, {
                            value: v,
                            path: childPath,
                            probabilisticPaths: probabilisticPaths,
                            probabilisticCheckedPaths: probabilisticCheckedPaths,
                            tolerantPaths: tolerantPaths,
                            depth: depth + 1
                        }, void 0, false, {
                            fileName: "[project]/components/highlight.tsx",
                            lineNumber: 210,
                            columnNumber: 13
                        }, this),
                        i < entries.length - 1 ? "," : "",
                        "\n"
                    ]
                }, k, true, {
                    fileName: "[project]/components/highlight.tsx",
                    lineNumber: 206,
                    columnNumber: 11
                }, this);
            }),
            pad,
            "}"
        ]
    }, void 0, true);
}
_c4 = JsonFieldKindNode;
const PRETTY_KEY_VALUE_LINE_RE = /^(\s*)"((?:\\.|[^"\\])*)"\s*:\s*(.*?)(,?)$/;
function jsonLeafDisplayText(value) {
    const text = JSON.stringify(value);
    return text ?? "undefined";
}
function leafValueAtPath(root, path, lineFragment) {
    const atPath = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$json$2d$pretty$2d$lines$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["valueAtJsonPath"])(root, path);
    if (atPath !== undefined) return atPath;
    const parsed = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$json$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tryParseJson"])(lineFragment.trim().replace(/,$/, ""));
    return parsed.ok ? parsed.value : atPath;
}
function PrettyJsonLineContent({ line, path, root, probabilisticPaths, probabilisticCheckedPaths, tolerantPaths = [] }) {
    const keyVal = line.match(PRETTY_KEY_VALUE_LINE_RE);
    if (keyVal && path) {
        const [, indent, keyEsc, valuePart, comma] = keyVal;
        const key = JSON.parse(`"${keyEsc}"`);
        const rest = valuePart.trim();
        const tol = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$testing$2d$files$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toleranceForFieldPath"])(path, tolerantPaths);
        if (rest === "{" || rest === "[" || rest === "{," || rest === "[,") {
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(InlineJsonTokens, {
                text: line
            }, void 0, false, {
                fileName: "[project]/components/highlight.tsx",
                lineNumber: 265,
                columnNumber: 14
            }, this);
        }
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                indent,
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(tol !== undefined ? "text-output" : "text-chart-2"),
                    children: [
                        '"',
                        key,
                        '"'
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/highlight.tsx",
                    lineNumber: 270,
                    columnNumber: 9
                }, this),
                ": ",
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(JsonLeafValue, {
                    value: leafValueAtPath(root, path, rest),
                    path: path,
                    probabilisticPaths: probabilisticPaths,
                    probabilisticCheckedPaths: probabilisticCheckedPaths,
                    tolerantPaths: tolerantPaths
                }, void 0, false, {
                    fileName: "[project]/components/highlight.tsx",
                    lineNumber: 272,
                    columnNumber: 9
                }, this),
                comma ?? ""
            ]
        }, void 0, true);
    }
    if (path) {
        const indent = line.slice(0, line.length - line.trimStart().length);
        const body = line.trim().replace(/,$/, "");
        if (body !== "{" && body !== "[" && body !== "}" && body !== "]") {
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    indent,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(JsonLeafValue, {
                        value: leafValueAtPath(root, path, body),
                        path: path,
                        probabilisticPaths: probabilisticPaths,
                        probabilisticCheckedPaths: probabilisticCheckedPaths,
                        tolerantPaths: tolerantPaths
                    }, void 0, false, {
                        fileName: "[project]/components/highlight.tsx",
                        lineNumber: 291,
                        columnNumber: 11
                    }, this),
                    line.endsWith(",") ? "," : ""
                ]
            }, void 0, true);
        }
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(InlineJsonTokens, {
        text: line
    }, void 0, false, {
        fileName: "[project]/components/highlight.tsx",
        lineNumber: 304,
        columnNumber: 10
    }, this);
}
_c5 = PrettyJsonLineContent;
function JsonFieldKindLineView({ root, lines, differingLineIndexes, pairedLines, probabilisticPaths, probabilisticCheckedPaths, tolerantPaths = [], diffExplanations }) {
    _s();
    const paths = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "JsonFieldKindLineView.useMemo[paths]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$json$2d$pretty$2d$lines$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["assignPathsToPrettyLines"])(lines)
    }["JsonFieldKindLineView.useMemo[paths]"], [
        lines
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
        className: "overflow-x-auto font-mono text-[11px] leading-relaxed",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("code", {
            children: lines.map((line, i)=>{
                const paired = pairedLines?.[i];
                const path = paths[i];
                const isProb = path ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$testing$2d$files$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isProbabilisticFieldPath"])(path, probabilisticPaths) : false;
                const showMismatch = differingLineIndexes.has(i) && !isProb;
                const notComment = showMismatch && paired !== undefined ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$json$2d$pretty$2d$lines$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["prettyJsonLineCompareComment"])(paired) : undefined;
                const explanation = showMismatch && path ? diffExplanations?.get(path) : undefined;
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("block whitespace-pre", showMismatch && "bg-destructive/15"),
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PrettyJsonLineContent, {
                            line: line,
                            path: path,
                            root: root,
                            probabilisticPaths: probabilisticPaths,
                            probabilisticCheckedPaths: probabilisticCheckedPaths,
                            tolerantPaths: tolerantPaths
                        }, void 0, false, {
                            fileName: "[project]/components/highlight.tsx",
                            lineNumber: 344,
                            columnNumber: 15
                        }, this),
                        notComment !== undefined && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-muted-foreground/75",
                            children: ` // not "${notComment}"`
                        }, void 0, false, {
                            fileName: "[project]/components/highlight.tsx",
                            lineNumber: 353,
                            columnNumber: 17
                        }, this),
                        explanation && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-destructive/80",
                            children: ` // because: ${explanation}`
                        }, void 0, false, {
                            fileName: "[project]/components/highlight.tsx",
                            lineNumber: 356,
                            columnNumber: 17
                        }, this)
                    ]
                }, i, true, {
                    fileName: "[project]/components/highlight.tsx",
                    lineNumber: 340,
                    columnNumber: 13
                }, this);
            })
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 330,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/highlight.tsx",
        lineNumber: 329,
        columnNumber: 5
    }, this);
}
_s(JsonFieldKindLineView, "VCCfbpTS+HZzS8OnwHVl0IVZqMw=");
_c6 = JsonFieldKindLineView;
function JsonFieldKindHighlight({ json, probabilisticPaths, probabilisticCheckedPaths, tolerantPaths = [], differingLineIndexes, pairedLines, diffExplanations }) {
    const parsed = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$json$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tryParseJson"])(json, {
        trim: true
    });
    if (!parsed.ok) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(JsonHighlight, {
        json: json
    }, void 0, false, {
        fileName: "[project]/components/highlight.tsx",
        lineNumber: 386,
        columnNumber: 26
    }, this);
    const normalized = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$deep_equal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeTestJson"])(parsed.value);
    if (differingLineIndexes) {
        const lines = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$deep_equal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["stablePrettyJson"])(normalized).split("\n");
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(JsonFieldKindLineView, {
            root: normalized,
            lines: lines,
            differingLineIndexes: differingLineIndexes,
            pairedLines: pairedLines,
            probabilisticPaths: probabilisticPaths,
            probabilisticCheckedPaths: probabilisticCheckedPaths,
            tolerantPaths: tolerantPaths,
            diffExplanations: diffExplanations
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 391,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
        className: "overflow-x-auto font-mono text-[11px] leading-relaxed",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("code", {
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(JsonFieldKindNode, {
                value: normalized,
                path: "",
                probabilisticPaths: probabilisticPaths,
                probabilisticCheckedPaths: probabilisticCheckedPaths,
                tolerantPaths: tolerantPaths,
                depth: 0
            }, void 0, false, {
                fileName: "[project]/components/highlight.tsx",
                lineNumber: 406,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 405,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/highlight.tsx",
        lineNumber: 404,
        columnNumber: 5
    }, this);
}
_c7 = JsonFieldKindHighlight;
const LOG_PREFIX_RE = /^(\[\d{2}:\d{2}:\d{2}\.\d{3}\]) (\[(?:DEBUG|INFO|WARN|ERROR)\]) (\[[^\]]+\]) (.*)$/;
const LOG_LEVEL_CLASS = {
    debug: "text-muted-foreground",
    info: "text-foreground/80",
    warn: "text-yellow-500",
    error: "text-destructive"
};
function logMessageBody(line, tag) {
    const needle = `] [${tag}] `;
    const idx = line.indexOf(needle);
    return idx >= 0 ? line.slice(idx + needle.length) : line;
}
function ServerLogLineHighlight({ line, level, tag }) {
    const m = line.match(LOG_PREFIX_RE);
    if (!m) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: LOG_LEVEL_CLASS[level],
            children: line
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 439,
            columnNumber: 12
        }, this);
    }
    const [, ts, levelBracket, tagBracket, bodyFromLine] = m;
    const body = bodyFromLine || logMessageBody(line, tag);
    const parsedLevel = levelBracket.slice(1, -1).toLowerCase();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-muted-foreground/60",
                children: [
                    ts,
                    " "
                ]
            }, void 0, true, {
                fileName: "[project]/components/highlight.tsx",
                lineNumber: 446,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: LOG_LEVEL_CLASS[parsedLevel] ?? LOG_LEVEL_CLASS[level],
                children: [
                    levelBracket,
                    " "
                ]
            }, void 0, true, {
                fileName: "[project]/components/highlight.tsx",
                lineNumber: 447,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-muted-foreground/80",
                children: [
                    tagBracket,
                    " "
                ]
            }, void 0, true, {
                fileName: "[project]/components/highlight.tsx",
                lineNumber: 448,
                columnNumber: 7
            }, this),
            body && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-foreground/90",
                children: body
            }, void 0, false, {
                fileName: "[project]/components/highlight.tsx",
                lineNumber: 449,
                columnNumber: 16
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/highlight.tsx",
        lineNumber: 445,
        columnNumber: 5
    }, this);
}
_c8 = ServerLogLineHighlight;
function isSafeMarkdownHref(href) {
    if (!href) return false;
    const trimmed = href.trim();
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
    return /^(https?:|mailto:)/i.test(trimmed);
}
function isSafeImageSrc(src) {
    if (!src) return false;
    const trimmed = src.trim();
    if (trimmed.startsWith("data:image/")) return /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);/i.test(trimmed);
    return /^https?:/i.test(trimmed);
}
const markdownComponents = {
    h1: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
            className: "mb-2 text-base font-semibold text-foreground",
            children: children
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 469,
            columnNumber: 25
        }, ("TURBOPACK compile-time value", void 0)),
    h2: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
            className: "mb-1.5 mt-4 text-sm font-semibold text-foreground",
            children: children
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 470,
            columnNumber: 25
        }, ("TURBOPACK compile-time value", void 0)),
    h3: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
            className: "mb-1 mt-3 text-sm font-medium text-foreground",
            children: children
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 471,
            columnNumber: 25
        }, ("TURBOPACK compile-time value", void 0)),
    h4: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
            className: "mb-1 mt-2 text-xs font-medium text-foreground",
            children: children
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 472,
            columnNumber: 25
        }, ("TURBOPACK compile-time value", void 0)),
    p: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
            className: "mb-2 text-muted-foreground",
            children: children
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 473,
            columnNumber: 24
        }, ("TURBOPACK compile-time value", void 0)),
    strong: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
            className: "font-medium text-foreground",
            children: children
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 474,
            columnNumber: 29
        }, ("TURBOPACK compile-time value", void 0)),
    ul: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
            className: "mb-2 list-disc space-y-1 pl-5 text-muted-foreground",
            children: children
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 475,
            columnNumber: 25
        }, ("TURBOPACK compile-time value", void 0)),
    ol: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
            className: "mb-2 list-decimal space-y-1 pl-5 text-muted-foreground",
            children: children
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 476,
            columnNumber: 25
        }, ("TURBOPACK compile-time value", void 0)),
    li: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
            className: "leading-relaxed",
            children: children
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 477,
            columnNumber: 25
        }, ("TURBOPACK compile-time value", void 0)),
    blockquote: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("blockquote", {
            className: "mb-2 border-l-2 border-primary/40 pl-3 text-muted-foreground",
            children: children
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 479,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0)),
    hr: ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("hr", {
            className: "my-4 border-border"
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 481,
            columnNumber: 13
        }, ("TURBOPACK compile-time value", void 0)),
    a: ({ href, children })=>isSafeMarkdownHref(href) ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
            href: href,
            className: "text-primary underline-offset-2 hover:underline",
            target: "_blank",
            rel: "noreferrer noopener",
            children: children
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 484,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "text-muted-foreground",
            children: children
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 488,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0)),
    img: ({ src, alt })=>{
        const srcStr = typeof src === "string" ? src : undefined;
        return isSafeImageSrc(srcStr) ? // eslint-disable-next-line @next/next/no-img-element -- markdown user content; src allowlisted above
        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
            src: srcStr,
            alt: alt ?? "",
            className: "my-2 max-w-full rounded border border-border",
            loading: "lazy"
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 494,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0)) : null;
    },
    code: ({ className, children })=>className ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("code", {
            className: "font-mono text-[11px] text-primary",
            children: children
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 499,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("code", {
            className: "rounded bg-secondary px-1 font-mono text-[11px] text-primary",
            children: children
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 501,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0)),
    pre: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
            className: "mb-2 overflow-x-auto rounded border border-border bg-secondary/50 p-2 font-mono text-[11px] text-primary",
            children: children
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 504,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0)),
    table: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "mb-3 overflow-x-auto",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                className: "w-full border-collapse text-[11px]",
                children: children
            }, void 0, false, {
                fileName: "[project]/components/highlight.tsx",
                lineNumber: 510,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 509,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0)),
    thead: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
            className: "bg-secondary",
            children: children
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 513,
            columnNumber: 28
        }, ("TURBOPACK compile-time value", void 0)),
    th: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
            className: "border border-border px-2 py-1 text-left font-medium text-foreground",
            children: children
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 515,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0)),
    td: ({ children })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
            className: "border border-border px-2 py-1 text-muted-foreground",
            children: children
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 517,
            columnNumber: 25
        }, ("TURBOPACK compile-time value", void 0))
};
function MarkdownView({ md }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "text-xs leading-relaxed text-foreground",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$markdown$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__Markdown__as__default$3e$__["default"], {
            remarkPlugins: [
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$remark$2d$gfm$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]
            ],
            rehypePlugins: [
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$rehype$2d$sanitize$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]
            ],
            components: markdownComponents,
            children: md
        }, void 0, false, {
            fileName: "[project]/components/highlight.tsx",
            lineNumber: 523,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/highlight.tsx",
        lineNumber: 522,
        columnNumber: 5
    }, this);
}
_c9 = MarkdownView;
function PromptText({ text, sourceDocId }) {
    const parts = splitJsonSegments(text);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: parts.map((p, i)=>p.isJson ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "my-1 block rounded border border-border bg-[oklch(0.14_0.004_264)] p-2",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(JsonHighlight, {
                    json: p.text
                }, void 0, false, {
                    fileName: "[project]/components/highlight.tsx",
                    lineNumber: 538,
                    columnNumber: 13
                }, this)
            }, i, false, {
                fileName: "[project]/components/highlight.tsx",
                lineNumber: 537,
                columnNumber: 11
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PlainPromptSegment, {
                text: p.text,
                sourceDocId: sourceDocId
            }, i, false, {
                fileName: "[project]/components/highlight.tsx",
                lineNumber: 541,
                columnNumber: 11
            }, this))
    }, void 0, false);
}
_c10 = PromptText;
// AI : parse doc id from SOURCE DOCUMENT (sha_…, N chars): headers stored in run logs.
function parseSourceDocHeader(header) {
    const withMeta = header.match(/^SOURCE DOCUMENT \(([^,)]+)(?:, (\d+) chars)?\):$/);
    if (withMeta) {
        return {
            docId: withMeta[1],
            charCount: withMeta[2] ? +withMeta[2] : undefined,
            label: header
        };
    }
    return {
        label: header
    };
}
// AI : highlight SOURCE DOCUMENT blocks in LLM prompts and Link Quotes step input.
function PlainPromptSegment({ text, sourceDocId }) {
    const startMatch = text.match(/SOURCE DOCUMENT(?: \([^)]+\))?:\n/);
    if (!startMatch || startMatch.index === undefined) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        children: text
    }, void 0, false, {
        fileName: "[project]/components/highlight.tsx",
        lineNumber: 566,
        columnNumber: 61
    }, this);
    const start = startMatch.index;
    const headerEnd = start + startMatch[0].length;
    const header = startMatch[0].trimEnd();
    const tailMarkers = [
        "\n\n── RAW EXTRACTS ──\n",
        "\n\nINPUT DATA:",
        "\n\nRespond with ONLY"
    ];
    let bodyEnd = text.length;
    for (const m of tailMarkers){
        const idx = text.indexOf(m, headerEnd);
        if (idx !== -1) bodyEnd = Math.min(bodyEnd, idx);
    }
    const before = text.slice(0, start);
    const body = text.slice(headerEnd, bodyEnd);
    const after = text.slice(bodyEnd);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        children: [
            before,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SourceDocumentBlock, {
                header: header,
                body: body,
                sourceDocId: sourceDocId
            }, void 0, false, {
                fileName: "[project]/components/highlight.tsx",
                lineNumber: 585,
                columnNumber: 7
            }, this),
            after
        ]
    }, void 0, true, {
        fileName: "[project]/components/highlight.tsx",
        lineNumber: 583,
        columnNumber: 5
    }, this);
}
_c11 = PlainPromptSegment;
function SourceDocumentBlock({ header, body, sourceDocId }) {
    _s1();
    const { open } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$doc$2d$viewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useDocViewer"])();
    const parsed = parseSourceDocHeader(header);
    const docId = parsed.docId ?? sourceDocId;
    function openDoc() {
        if (!docId) return;
        open({
            docId,
            start: 0,
            end: 0
        });
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "my-1 block rounded border border-chart-2/40 bg-chart-2/10 p-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-wrap items-center justify-between gap-2",
                children: [
                    docId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: openDoc,
                        className: "font-mono text-[10px] font-semibold uppercase tracking-wide text-chart-2 hover:underline",
                        title: `Open source document ${docId}`,
                        children: [
                            "SOURCE DOCUMENT (",
                            docId,
                            parsed.charCount != null ? `, ${parsed.charCount} chars` : "",
                            "):"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/highlight.tsx",
                        lineNumber: 613,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "font-mono text-[10px] font-semibold uppercase tracking-wide text-chart-2",
                        children: parsed.label
                    }, void 0, false, {
                        fileName: "[project]/components/highlight.tsx",
                        lineNumber: 623,
                        columnNumber: 11
                    }, this),
                    docId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: openDoc,
                                className: "inline-flex items-center gap-1 font-mono text-[10px] text-primary hover:underline",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$link$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Link2$3e$__["Link2"], {
                                        className: "h-3 w-3"
                                    }, void 0, false, {
                                        fileName: "[project]/components/highlight.tsx",
                                        lineNumber: 634,
                                        columnNumber: 15
                                    }, this),
                                    "view original"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/highlight.tsx",
                                lineNumber: 629,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$open$2d$in$2d$documents$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OpenInDocumentsLink"], {
                                docId: docId,
                                label: "documents"
                            }, void 0, false, {
                                fileName: "[project]/components/highlight.tsx",
                                lineNumber: 637,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/highlight.tsx",
                        lineNumber: 628,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/highlight.tsx",
                lineNumber: 611,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "mt-1 block whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground",
                children: body.trimEnd()
            }, void 0, false, {
                fileName: "[project]/components/highlight.tsx",
                lineNumber: 641,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/highlight.tsx",
        lineNumber: 610,
        columnNumber: 5
    }, this);
}
_s1(SourceDocumentBlock, "qesihPhhVfuuIam/kvchbYiCtZI=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$doc$2d$viewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useDocViewer"]
    ];
});
_c12 = SourceDocumentBlock;
// Walk text finding balanced { } / [ ] that are valid JSON; split on them.
function splitJsonSegments(text) {
    const result = [];
    let i = 0;
    let buf = "";
    while(i < text.length){
        const c = text[i];
        if (c === "{" || c === "[") {
            const end = findJsonEnd(text, i);
            if (end !== -1) {
                const candidate = text.slice(i, end + 1);
                try {
                    JSON.parse(candidate);
                    if (buf) {
                        result.push({
                            text: buf,
                            isJson: false
                        });
                        buf = "";
                    }
                    result.push({
                        text: candidate,
                        isJson: true
                    });
                    i = end + 1;
                    continue;
                } catch  {}
            }
        }
        buf += c;
        i++;
    }
    if (buf) result.push({
        text: buf,
        isJson: false
    });
    return result;
}
// Return the index of the closing bracket matching text[start], or -1.
function findJsonEnd(text, start) {
    const open = text[start];
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inStr = false;
    let esc = false;
    for(let i = start; i < text.length; i++){
        const c = text[i];
        if (esc) {
            esc = false;
            continue;
        }
        if (c === "\\" && inStr) {
            esc = true;
            continue;
        }
        if (c === '"') {
            inStr = !inStr;
            continue;
        }
        if (inStr) continue;
        if (c === open) depth++;
        else if (c === close) {
            if (--depth === 0) return i;
        }
    }
    return -1;
}
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c10, _c11, _c12;
__turbopack_context__.k.register(_c, "InlineJsonTokens");
__turbopack_context__.k.register(_c1, "JsonHighlight");
__turbopack_context__.k.register(_c2, "JsonFieldKindLegend");
__turbopack_context__.k.register(_c3, "JsonLeafValue");
__turbopack_context__.k.register(_c4, "JsonFieldKindNode");
__turbopack_context__.k.register(_c5, "PrettyJsonLineContent");
__turbopack_context__.k.register(_c6, "JsonFieldKindLineView");
__turbopack_context__.k.register(_c7, "JsonFieldKindHighlight");
__turbopack_context__.k.register(_c8, "ServerLogLineHighlight");
__turbopack_context__.k.register(_c9, "MarkdownView");
__turbopack_context__.k.register(_c10, "PromptText");
__turbopack_context__.k.register(_c11, "PlainPromptSegment");
__turbopack_context__.k.register(_c12, "SourceDocumentBlock");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/time-ago.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "timeAgo",
    ()=>timeAgo
]);
function timeAgo(ts, now = Date.now()) {
    const sec = Math.max(0, Math.floor((now - ts) / 1000));
    if (sec < 10) return "just now";
    if (sec < 60) return `${sec}s ago`;
    const mins = Math.floor(sec / 60);
    if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    const weeks = Math.floor(days / 7);
    return `${weeks} wk${weeks === 1 ? "" : "s"} ago`;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/pipeline-summary-box.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PipelineSummaryBox",
    ()=>PipelineSummaryBox
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.mjs [app-client] (ecmascript) <export default as Loader2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$scroll$2d$text$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ScrollText$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/scroll-text.mjs [app-client] (ecmascript) <export default as ScrollText>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$routes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api-routes.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api-client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$highlight$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/highlight.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/store.tsx [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$time$2d$ago$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/time-ago.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
const STREAM_EVENT = {
    DELTA: "delta",
    DONE: "done",
    ERROR: "error"
};
function PipelineSummaryBox() {
    _s();
    const { project, model: globalModel } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useStore"])();
    const [streaming, setStreaming] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [text, setText] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [generatedAt, setGeneratedAt] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [now, setNow] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "PipelineSummaryBox.useState": ()=>Date.now()
    }["PipelineSummaryBox.useState"]);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const outputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PipelineSummaryBox.useEffect": ()=>{
            if (!generatedAt) return;
            const id = setInterval({
                "PipelineSummaryBox.useEffect.id": ()=>setNow(Date.now())
            }["PipelineSummaryBox.useEffect.id"], 30_000);
            return ({
                "PipelineSummaryBox.useEffect": ()=>clearInterval(id)
            })["PipelineSummaryBox.useEffect"];
        }
    }["PipelineSummaryBox.useEffect"], [
        generatedAt
    ]);
    async function generate() {
        setStreaming(true);
        setText("");
        setGeneratedAt(null);
        setError(null);
        try {
            const res = await fetch(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$routes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["API_ROUTES"].pipelineSummary, {
                method: "POST",
                headers: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["JSON_HEADERS"],
                credentials: "same-origin",
                body: JSON.stringify({
                    projectId: project.id,
                    model: globalModel
                })
            });
            if (!res.ok) {
                const body = await res.json().catch(()=>null);
                throw new Error(body?.error ?? `request failed (${res.status})`);
            }
            const reader = res.body?.getReader();
            if (!reader) throw new Error("empty response body");
            const decoder = new TextDecoder();
            let buffer = "";
            let acc = "";
            while(true){
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, {
                    stream: true
                });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines){
                    if (!line.trim()) continue;
                    const evt = JSON.parse(line);
                    if (evt.type === STREAM_EVENT.ERROR) throw new Error(evt.error ?? "summary failed");
                    if (evt.type === STREAM_EVENT.DELTA && evt.text) {
                        acc += evt.text;
                        setText(acc);
                        outputRef.current?.scrollIntoView({
                            block: "nearest",
                            behavior: "smooth"
                        });
                    }
                    if (evt.type === STREAM_EVENT.DONE && evt.text) {
                        acc = evt.text;
                        setText(acc);
                    }
                }
            }
            if (acc.trim()) setGeneratedAt(Date.now());
        } catch (err) {
            setError(err.message);
        } finally{
            setStreaming(false);
        }
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex w-full flex-col items-center pt-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                variant: "outline",
                size: "sm",
                className: "h-8 gap-1.5 border-dashed bg-transparent text-xs text-muted-foreground hover:border-primary hover:bg-primary/5 hover:text-foreground",
                onClick: ()=>void generate(),
                disabled: streaming,
                children: [
                    streaming ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                        className: "h-3.5 w-3.5 animate-spin"
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-summary-box.tsx",
                        lineNumber: 99,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$scroll$2d$text$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ScrollText$3e$__["ScrollText"], {
                        className: "h-3.5 w-3.5"
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-summary-box.tsx",
                        lineNumber: 101,
                        columnNumber: 11
                    }, this),
                    streaming ? "Generating…" : "Generate summary"
                ]
            }, void 0, true, {
                fileName: "[project]/components/pipeline-summary-box.tsx",
                lineNumber: 91,
                columnNumber: 7
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-3 max-w-xl text-center font-mono text-[11px] text-destructive",
                children: error
            }, void 0, false, {
                fileName: "[project]/components/pipeline-summary-box.tsx",
                lineNumber: 107,
                columnNumber: 9
            }, this),
            (text || streaming) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                ref: outputRef,
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("mt-4 w-full max-w-xl rounded-lg border border-border/60 bg-secondary/20 px-4 py-3"),
                children: [
                    generatedAt && !streaming && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mb-3 font-mono text-[10px] text-muted-foreground",
                        children: [
                            "Generated ",
                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$time$2d$ago$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["timeAgo"])(generatedAt, now)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/pipeline-summary-box.tsx",
                        lineNumber: 118,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$highlight$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MarkdownView"], {
                        md: text
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-summary-box.tsx",
                        lineNumber: 122,
                        columnNumber: 11
                    }, this),
                    streaming && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "inline-block animate-pulse text-primary",
                        children: "▍"
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-summary-box.tsx",
                        lineNumber: 123,
                        columnNumber: 25
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/pipeline-summary-box.tsx",
                lineNumber: 111,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/pipeline-summary-box.tsx",
        lineNumber: 90,
        columnNumber: 5
    }, this);
}
_s(PipelineSummaryBox, "vDtu2/6Ga1eDYlR52/HXNQ6G+64=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useStore"]
    ];
});
_c = PipelineSummaryBox;
var _c;
__turbopack_context__.k.register(_c, "PipelineSummaryBox");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/ui/switch.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Switch",
    ()=>Switch
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$switch$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Switch$3e$__ = __turbopack_context__.i("[project]/node_modules/@base-ui/react/esm/switch/index.parts.js [app-client] (ecmascript) <export * as Switch>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
"use client";
;
;
;
function Switch({ className, size = "default", ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$switch$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Switch$3e$__["Switch"].Root, {
        "data-slot": "switch",
        "data-size": size,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50", className),
        ...props,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$switch$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Switch$3e$__["Switch"].Thumb, {
            "data-slot": "switch-thumb",
            className: "pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] dark:data-checked:bg-primary-foreground group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 dark:data-unchecked:bg-foreground"
        }, void 0, false, {
            fileName: "[project]/components/ui/switch.tsx",
            lineNumber: 24,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/ui/switch.tsx",
        lineNumber: 15,
        columnNumber: 5
    }, this);
}
_c = Switch;
;
var _c;
__turbopack_context__.k.register(_c, "Switch");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/spine-type.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

// AI : client-safe spine type helpers — re-exported for pipeline UI.
__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/type_expr.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$spine_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/spine_types.ts [app-client] (ecmascript) <locals>");
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/use-model-options.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "modelLabel",
    ()=>modelLabel,
    "useModelOptions",
    ()=>useModelOptions
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$model_catalog$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/model_catalog.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/store.tsx [app-client] (ecmascript) <locals>");
var _s = __turbopack_context__.k.signature();
"use client";
;
;
function useModelOptions() {
    _s();
    const builder = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useOptionalStore"])();
    const consumer = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useOptionalConsumerStore"])();
    const source = builder ?? consumer;
    if (!source) throw new Error("useModelOptions requires StoreProvider");
    return source.modelOptions;
}
_s(useModelOptions, "Du9jm79+5cvjErO54CchJRmG+vw=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useOptionalStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useOptionalConsumerStore"]
    ];
});
function modelLabel(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$model_catalog$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["catalogLabel"])(id) ?? id ?? "—";
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/model-selector.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ModelSelector",
    ()=>ModelSelector
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/check.mjs [app-client] (ecmascript) <export default as Check>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDown$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-down.mjs [app-client] (ecmascript) <export default as ChevronDown>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/dropdown-menu.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$model_catalog$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/model_catalog.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$use$2d$model$2d$options$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/use-model-options.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
function sortModelsByPrice(models) {
    return [
        ...models
    ].sort((a, b)=>{
        const aCost = a.costPer1k > 0 ? a.costPer1k : Number.POSITIVE_INFINITY;
        const bCost = b.costPer1k > 0 ? b.costPer1k : Number.POSITIVE_INFINITY;
        return aCost - bCost;
    });
}
function relativePricePct(costPer1k, minCost, maxCost) {
    if (costPer1k <= 0 || maxCost <= minCost) return 0;
    return Math.round((costPer1k - minCost) / (maxCost - minCost) * 100);
}
function ModelSelector({ value, onChange, size = "sm" }) {
    _s();
    const options = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$use$2d$model$2d$options$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useModelOptions"])();
    const sortedOptions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "ModelSelector.useMemo[sortedOptions]": ()=>sortModelsByPrice(options)
    }["ModelSelector.useMemo[sortedOptions]"], [
        options
    ]);
    const { minCost, maxCost } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "ModelSelector.useMemo": ()=>{
            const costs = options.map({
                "ModelSelector.useMemo.costs": (m)=>m.costPer1k
            }["ModelSelector.useMemo.costs"]).filter({
                "ModelSelector.useMemo.costs": (c)=>c > 0
            }["ModelSelector.useMemo.costs"]);
            if (costs.length === 0) return {
                minCost: 0,
                maxCost: 0
            };
            return {
                minCost: Math.min(...costs),
                maxCost: Math.max(...costs)
            };
        }
    }["ModelSelector.useMemo"], [
        options
    ]);
    const current = options.find((m)=>m.id === value) ?? options[0];
    const label = current?.label ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$model_catalog$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["catalogLabel"])(value);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenu"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuTrigger"], {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex items-center gap-1.5 rounded-md border border-border bg-secondary font-mono text-muted-foreground transition-colors hover:text-foreground", size === "sm" ? "px-2.5 py-1.5 text-[11px]" : "px-2 py-1 text-[10px]"),
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-foreground",
                        children: label
                    }, void 0, false, {
                        fileName: "[project]/components/model-selector.tsx",
                        lineNumber: 63,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDown$3e$__["ChevronDown"], {
                        className: "h-3 w-3"
                    }, void 0, false, {
                        fileName: "[project]/components/model-selector.tsx",
                        lineNumber: 64,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/model-selector.tsx",
                lineNumber: 57,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuContent"], {
                align: "end",
                className: "w-64",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuGroup"], {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuLabel"], {
                            className: "font-mono text-[10px] text-muted-foreground",
                            children: "routed via openrouter"
                        }, void 0, false, {
                            fileName: "[project]/components/model-selector.tsx",
                            lineNumber: 68,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/model-selector.tsx",
                        lineNumber: 67,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuSeparator"], {}, void 0, false, {
                        fileName: "[project]/components/model-selector.tsx",
                        lineNumber: 72,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuGroup"], {
                        children: sortedOptions.map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuItem"], {
                                onClick: ()=>onChange(m.id),
                                className: "flex flex-col items-stretch gap-1.5 font-mono text-[11px]",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center justify-between gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: m.label
                                            }, void 0, false, {
                                                fileName: "[project]/components/model-selector.tsx",
                                                lineNumber: 81,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "flex items-center gap-1.5 text-muted-foreground",
                                                children: [
                                                    m.costPer1k > 0 ? `${m.costPer1k}¢/1k` : "…",
                                                    m.id === value && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                                                        className: "h-3 w-3 text-primary"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/model-selector.tsx",
                                                        lineNumber: 84,
                                                        columnNumber: 36
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/model-selector.tsx",
                                                lineNumber: 82,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/model-selector.tsx",
                                        lineNumber: 80,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "relative h-1 w-full overflow-hidden rounded-full bg-muted",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "h-full bg-primary transition-all",
                                            style: {
                                                width: `${relativePricePct(m.costPer1k, minCost, maxCost)}%`
                                            }
                                        }, void 0, false, {
                                            fileName: "[project]/components/model-selector.tsx",
                                            lineNumber: 88,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/components/model-selector.tsx",
                                        lineNumber: 87,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, m.id, true, {
                                fileName: "[project]/components/model-selector.tsx",
                                lineNumber: 75,
                                columnNumber: 11
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/components/model-selector.tsx",
                        lineNumber: 73,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/model-selector.tsx",
                lineNumber: 66,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/model-selector.tsx",
        lineNumber: 56,
        columnNumber: 5
    }, this);
}
_s(ModelSelector, "ywxHHpXfCNY1YIY6ik2kjBWrxFs=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$use$2d$model$2d$options$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useModelOptions"]
    ];
});
_c = ModelSelector;
var _c;
__turbopack_context__.k.register(_c, "ModelSelector");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/ui/select.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Select",
    ()=>Select,
    "SelectContent",
    ()=>SelectContent,
    "SelectGroup",
    ()=>SelectGroup,
    "SelectItem",
    ()=>SelectItem,
    "SelectLabel",
    ()=>SelectLabel,
    "SelectScrollDownButton",
    ()=>SelectScrollDownButton,
    "SelectScrollUpButton",
    ()=>SelectScrollUpButton,
    "SelectSeparator",
    ()=>SelectSeparator,
    "SelectTrigger",
    ()=>SelectTrigger,
    "SelectValue",
    ()=>SelectValue
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$select$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Select$3e$__ = __turbopack_context__.i("[project]/node_modules/@base-ui/react/esm/select/index.parts.js [app-client] (ecmascript) <export * as Select>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDownIcon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-down.mjs [app-client] (ecmascript) <export default as ChevronDownIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckIcon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/check.mjs [app-client] (ecmascript) <export default as CheckIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$up$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronUpIcon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-up.mjs [app-client] (ecmascript) <export default as ChevronUpIcon>");
"use client";
;
;
;
;
const Select = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$select$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Select$3e$__["Select"].Root;
function SelectGroup({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$select$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Select$3e$__["Select"].Group, {
        "data-slot": "select-group",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("scroll-my-1 p-1", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/select.tsx",
        lineNumber: 13,
        columnNumber: 5
    }, this);
}
_c = SelectGroup;
function SelectValue({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$select$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Select$3e$__["Select"].Value, {
        "data-slot": "select-value",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex flex-1 text-left", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/select.tsx",
        lineNumber: 23,
        columnNumber: 5
    }, this);
}
_c1 = SelectValue;
function SelectTrigger({ className, size = "default", children, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$select$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Select$3e$__["Select"].Trigger, {
        "data-slot": "select-trigger",
        "data-size": size,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", className),
        ...props,
        children: [
            children,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$select$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Select$3e$__["Select"].Icon, {
                render: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDownIcon$3e$__["ChevronDownIcon"], {
                    className: "pointer-events-none size-4 text-muted-foreground"
                }, void 0, false, {
                    fileName: "[project]/components/ui/select.tsx",
                    lineNumber: 52,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/ui/select.tsx",
                lineNumber: 50,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/ui/select.tsx",
        lineNumber: 40,
        columnNumber: 5
    }, this);
}
_c2 = SelectTrigger;
function SelectContent({ className, children, side = "bottom", sideOffset = 4, align = "center", alignOffset = 0, alignItemWithTrigger = true, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$select$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Select$3e$__["Select"].Portal, {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$select$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Select$3e$__["Select"].Positioner, {
            side: side,
            sideOffset: sideOffset,
            align: align,
            alignOffset: alignOffset,
            alignItemWithTrigger: alignItemWithTrigger,
            className: "isolate z-50",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$select$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Select$3e$__["Select"].Popup, {
                "data-slot": "select-content",
                "data-align-trigger": alignItemWithTrigger,
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className),
                ...props,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectScrollUpButton, {}, void 0, false, {
                        fileName: "[project]/components/ui/select.tsx",
                        lineNumber: 89,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$select$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Select$3e$__["Select"].List, {
                        children: children
                    }, void 0, false, {
                        fileName: "[project]/components/ui/select.tsx",
                        lineNumber: 90,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectScrollDownButton, {}, void 0, false, {
                        fileName: "[project]/components/ui/select.tsx",
                        lineNumber: 91,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/ui/select.tsx",
                lineNumber: 83,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/components/ui/select.tsx",
            lineNumber: 75,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/ui/select.tsx",
        lineNumber: 74,
        columnNumber: 5
    }, this);
}
_c3 = SelectContent;
function SelectLabel({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$select$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Select$3e$__["Select"].GroupLabel, {
        "data-slot": "select-label",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("px-1.5 py-1 text-xs text-muted-foreground", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/select.tsx",
        lineNumber: 103,
        columnNumber: 5
    }, this);
}
_c4 = SelectLabel;
function SelectItem({ className, children, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$select$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Select$3e$__["Select"].Item, {
        "data-slot": "select-item",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2", className),
        ...props,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$select$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Select$3e$__["Select"].ItemText, {
                className: "flex flex-1 shrink-0 gap-2 whitespace-nowrap",
                children: children
            }, void 0, false, {
                fileName: "[project]/components/ui/select.tsx",
                lineNumber: 125,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$select$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Select$3e$__["Select"].ItemIndicator, {
                render: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "pointer-events-none absolute right-2 flex size-4 items-center justify-center"
                }, void 0, false, {
                    fileName: "[project]/components/ui/select.tsx",
                    lineNumber: 130,
                    columnNumber: 11
                }, this),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckIcon$3e$__["CheckIcon"], {
                    className: "pointer-events-none"
                }, void 0, false, {
                    fileName: "[project]/components/ui/select.tsx",
                    lineNumber: 133,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/ui/select.tsx",
                lineNumber: 128,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/ui/select.tsx",
        lineNumber: 117,
        columnNumber: 5
    }, this);
}
_c5 = SelectItem;
function SelectSeparator({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$select$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Select$3e$__["Select"].Separator, {
        "data-slot": "select-separator",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("pointer-events-none -mx-1 my-1 h-px bg-border", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/select.tsx",
        lineNumber: 144,
        columnNumber: 5
    }, this);
}
_c6 = SelectSeparator;
function SelectScrollUpButton({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$select$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Select$3e$__["Select"].ScrollUpArrow, {
        "data-slot": "select-scroll-up-button",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4", className),
        ...props,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$up$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronUpIcon$3e$__["ChevronUpIcon"], {}, void 0, false, {
            fileName: "[project]/components/ui/select.tsx",
            lineNumber: 165,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/ui/select.tsx",
        lineNumber: 157,
        columnNumber: 5
    }, this);
}
_c7 = SelectScrollUpButton;
function SelectScrollDownButton({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$select$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Select$3e$__["Select"].ScrollDownArrow, {
        "data-slot": "select-scroll-down-button",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4", className),
        ...props,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDownIcon$3e$__["ChevronDownIcon"], {}, void 0, false, {
            fileName: "[project]/components/ui/select.tsx",
            lineNumber: 184,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/ui/select.tsx",
        lineNumber: 176,
        columnNumber: 5
    }, this);
}
_c8 = SelectScrollDownButton;
;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8;
__turbopack_context__.k.register(_c, "SelectGroup");
__turbopack_context__.k.register(_c1, "SelectValue");
__turbopack_context__.k.register(_c2, "SelectTrigger");
__turbopack_context__.k.register(_c3, "SelectContent");
__turbopack_context__.k.register(_c4, "SelectLabel");
__turbopack_context__.k.register(_c5, "SelectItem");
__turbopack_context__.k.register(_c6, "SelectSeparator");
__turbopack_context__.k.register(_c7, "SelectScrollUpButton");
__turbopack_context__.k.register(_c8, "SelectScrollDownButton");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/pipeline-fields/shared.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "IoMismatchFieldFix",
    ()=>IoMismatchFieldFix,
    "OcrExtraFields",
    ()=>OcrExtraFields,
    "PipelineField",
    ()=>PipelineField,
    "StaticValue",
    ()=>StaticValue,
    "StructureModelSelect",
    ()=>StructureModelSelect,
    "llmModelLabel",
    ()=>llmModelLabel,
    "useLlmSchemaPreview",
    ()=>useLlmSchemaPreview
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// AI : primitives shared across all pipeline field sub-components.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/structure.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$structure$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/structure.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$kinds$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/module-kinds.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$spine$2d$type$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/spine-type.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$spine_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/spine_types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$use$2d$model$2d$options$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/use-model-options.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$model$2d$selector$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/model-selector.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$textarea$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/textarea.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/select.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
;
function llmModelLabel(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$use$2d$model$2d$options$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["modelLabel"])(id);
}
function useLlmSchemaPreview(selected, models, typeAliases = []) {
    _s();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "useLlmSchemaPreview.useMemo": ()=>{
            if (!selected || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$kinds$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isLlmKind"])(selected.kind) || !selected.outStructureId) return null;
            const out = models.find({
                "useLlmSchemaPreview.useMemo.out": (m)=>m.id === selected.outStructureId
            }["useLlmSchemaPreview.useMemo.out"]);
            if (!out) return null;
            const isList = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$spine_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["llmStepEmitsList"])(selected);
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$structure$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["llmSchemaJson"])(out, models, isList, typeAliases);
        }
    }["useLlmSchemaPreview.useMemo"], [
        selected,
        models,
        typeAliases
    ]);
}
_s(useLlmSchemaPreview, "nwk+m61qLgjDVUp4IGV/072DDN4=");
function PipelineField({ label, hint, hintTone = "warning", children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mb-3 min-w-0",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground",
                children: label
            }, void 0, false, {
                fileName: "[project]/components/pipeline-fields/shared.tsx",
                lineNumber: 63,
                columnNumber: 7
            }, this),
            hint && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("mb-1.5 font-mono text-[10px]", hintTone === "error" ? "text-destructive" : "WARNING_TEXT_CLASS"),
                children: hint
            }, void 0, false, {
                fileName: "[project]/components/pipeline-fields/shared.tsx",
                lineNumber: 67,
                columnNumber: 9
            }, this),
            children
        ]
    }, void 0, true, {
        fileName: "[project]/components/pipeline-fields/shared.tsx",
        lineNumber: 62,
        columnNumber: 5
    }, this);
}
_c = PipelineField;
function StaticValue({ children, mono, pre }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("rounded-md border border-border bg-secondary/30 px-2.5 py-2 text-sm", mono && "font-mono text-xs", pre && "whitespace-pre-wrap leading-relaxed"),
        children: children ?? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "text-muted-foreground",
            children: "—"
        }, void 0, false, {
            fileName: "[project]/components/pipeline-fields/shared.tsx",
            lineNumber: 90,
            columnNumber: 20
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/pipeline-fields/shared.tsx",
        lineNumber: 83,
        columnNumber: 5
    }, this);
}
_c1 = StaticValue;
function StructureModelSelect({ models, value, onValueChange, invalid }) {
    _s1();
    const items = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "StructureModelSelect.useMemo[items]": ()=>models.map({
                "StructureModelSelect.useMemo[items]": (m)=>({
                        value: m.id,
                        label: m.name
                    })
            }["StructureModelSelect.useMemo[items]"])
    }["StructureModelSelect.useMemo[items]"], [
        models
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
        value: value ?? null,
        onValueChange: (v)=>onValueChange(v ?? undefined),
        items: items,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectTrigger"], {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("h-8 font-mono text-xs", invalid && "border-destructive/70"),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectValue"], {
                    placeholder: "Select model"
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-fields/shared.tsx",
                    lineNumber: 114,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/pipeline-fields/shared.tsx",
                lineNumber: 113,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectContent"], {
                children: models.map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                        value: m.id,
                        label: m.name,
                        className: "font-mono text-xs",
                        children: m.name
                    }, m.id, false, {
                        fileName: "[project]/components/pipeline-fields/shared.tsx",
                        lineNumber: 118,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/components/pipeline-fields/shared.tsx",
                lineNumber: 116,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/pipeline-fields/shared.tsx",
        lineNumber: 108,
        columnNumber: 5
    }, this);
}
_s1(StructureModelSelect, "JuH2Tip3cwnoihIGVm6QoIvsF5k=");
_c2 = StructureModelSelect;
function IoMismatchFieldFix({ fix, edit, onFix }) {
    if (!fix) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mt-2 space-y-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "font-mono text-[10px] leading-relaxed text-destructive",
                children: fix.message
            }, void 0, false, {
                fileName: "[project]/components/pipeline-fields/shared.tsx",
                lineNumber: 139,
                columnNumber: 7
            }, this),
            fix.label && edit && onFix ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "button",
                variant: "outline",
                size: "sm",
                className: "h-7 border-destructive/40 font-mono text-[10px] text-destructive hover:bg-destructive/10",
                onClick: ()=>onFix(fix.mismatchModuleId, fix.kind),
                children: fix.label
            }, void 0, false, {
                fileName: "[project]/components/pipeline-fields/shared.tsx",
                lineNumber: 141,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/components/pipeline-fields/shared.tsx",
        lineNumber: 138,
        columnNumber: 5
    }, this);
}
_c3 = IoMismatchFieldFix;
function OcrExtraFields({ selected, edit, onUpdate }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PipelineField, {
                label: "Vision model",
                children: edit ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$model$2d$selector$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ModelSelector"], {
                    value: selected.model ?? "gemini-3-flash",
                    onChange: (v)=>onUpdate({
                            model: v
                        })
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-fields/shared.tsx",
                    lineNumber: 168,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StaticValue, {
                    mono: true,
                    children: llmModelLabel(selected.model ?? "gemini-3-flash")
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-fields/shared.tsx",
                    lineNumber: 173,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/pipeline-fields/shared.tsx",
                lineNumber: 166,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PipelineField, {
                label: "OCR prompt",
                hint: edit ? "optional — extra transcription instructions" : undefined,
                children: edit ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$textarea$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Textarea"], {
                    value: selected.prompt ?? "",
                    onChange: (e)=>onUpdate({
                            prompt: e.target.value
                        }),
                    placeholder: "e.g. preserve table columns; read handwritten amounts carefully…",
                    className: "min-h-20 resize-y text-xs leading-relaxed"
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-fields/shared.tsx",
                    lineNumber: 178,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StaticValue, {
                    mono: true,
                    pre: true,
                    children: selected.prompt?.trim() ? selected.prompt : "—"
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-fields/shared.tsx",
                    lineNumber: 185,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/pipeline-fields/shared.tsx",
                lineNumber: 176,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true);
}
_c4 = OcrExtraFields;
var _c, _c1, _c2, _c3, _c4;
__turbopack_context__.k.register(_c, "PipelineField");
__turbopack_context__.k.register(_c1, "StaticValue");
__turbopack_context__.k.register(_c2, "StructureModelSelect");
__turbopack_context__.k.register(_c3, "IoMismatchFieldFix");
__turbopack_context__.k.register(_c4, "OcrExtraFields");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/pipeline-fields/input-fields.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "InputModuleFields",
    ()=>InputModuleFields
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ui$2d$classes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/ui-classes.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/inference-input.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/inference-input-core.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$parse$2d$steps$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/structure-parse-steps.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/validity-sync.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/structure.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/builtin_models.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$validity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/validity.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$messages$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/validity-messages.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$spine$2d$type$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/spine-type.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$spine_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/spine_types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/structure-link.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$switch$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/switch.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/pipeline-fields/shared.tsx [app-client] (ecmascript)");
"use client";
;
;
;
;
;
;
;
;
;
;
;
;
;
function InputModuleFields({ selected, models, modules, edit, invalid, warnings, ioMismatchFix, onUpdate, onFixIoMismatch }) {
    const inputOcrAvailable = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["inputModuleNeedsOcr"])(selected);
    const allJsonNative = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["inputModuleTypesAreAllJsonNative"])(selected);
    const mergedModels = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["withSharedModels"])(models);
    const targetStructureId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["inputTargetStructureId"])(selected, modules);
    const targetStructure = mergedModels.find((m)=>m.id === targetStructureId);
    const autoParse = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["autoStructureParseStepForInput"])(modules, selected.id);
    const jsonNativeTypes = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["INPUT_TYPES"].filter((t)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isJsonNativeInputType"])(t.value));
    const convertTypes = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["INPUT_TYPES"].filter((t)=>!(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isJsonNativeInputType"])(t.value));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                label: "Input types",
                hint: edit ? "JSON-native types parse directly; others use a locked LLM convert step when a structure is selected" : undefined,
                children: edit ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "mb-1 font-mono text-[9px] uppercase tracking-wide text-muted-foreground",
                                    children: "JSON-native · direct parse"
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                                    lineNumber: 91,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-wrap gap-1.5",
                                    children: jsonNativeTypes.map((t)=>{
                                        const active = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["inputTypesForModule"])(selected).includes(t.value);
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TypeChip, {
                                            label: t.label,
                                            active: active,
                                            tone: "json",
                                            onClick: ()=>toggleInputType(t.value, active, selected, onUpdate)
                                        }, t.value, false, {
                                            fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                                            lineNumber: 98,
                                            columnNumber: 21
                                        }, this);
                                    })
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                                    lineNumber: 94,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                            lineNumber: 90,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "mb-1 font-mono text-[9px] uppercase tracking-wide text-muted-foreground",
                                    children: "Needs LLM conversion if not Document I/O model."
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                                    lineNumber: 110,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-wrap gap-1.5",
                                    children: convertTypes.map((t)=>{
                                        const active = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["inputTypesForModule"])(selected).includes(t.value);
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TypeChip, {
                                            label: t.label,
                                            active: active,
                                            tone: "convert",
                                            onClick: ()=>toggleInputType(t.value, active, selected, onUpdate)
                                        }, t.value, false, {
                                            fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                                            lineNumber: 117,
                                            columnNumber: 21
                                        }, this);
                                    })
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                                    lineNumber: 113,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                            lineNumber: 109,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                    lineNumber: 89,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StaticValue"], {
                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["inputTypeLabel"])(selected.inputType)
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                    lineNumber: 130,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                lineNumber: 84,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                label: "Structure loading",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-1 rounded-md border border-dashed border-border bg-secondary/20 px-3 py-2.5",
                    children: allJsonNative ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "font-mono text-[10px] leading-relaxed text-muted-foreground",
                        children: [
                            "Upload → JSON parse →",
                            " ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-foreground",
                                children: targetStructure?.name ?? "structure"
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                                lineNumber: 138,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                        lineNumber: 136,
                        columnNumber: 13
                    }, this) : targetStructure && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isBuiltinDocumentModel"])(targetStructure) ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "font-mono text-[10px] leading-relaxed text-muted-foreground",
                                children: [
                                    "Upload → Document →",
                                    " ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-primary",
                                        children: autoParse?.label ?? "Parse to structure"
                                    }, void 0, false, {
                                        fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                                        lineNumber: 144,
                                        columnNumber: 17
                                    }, this),
                                    " →",
                                    " ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-foreground",
                                        children: targetStructure.name
                                    }, void 0, false, {
                                        fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                                        lineNumber: 145,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                                lineNumber: 142,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "font-mono text-[9px] leading-relaxed text-muted-foreground/80",
                                children: "Locked LLM step is inserted automatically — you only pick the target structure below."
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                                lineNumber: 147,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "font-mono text-[10px] leading-relaxed text-muted-foreground",
                        children: "Upload → Document (raw text + filename)"
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                        lineNumber: 152,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                    lineNumber: 134,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                lineNumber: 133,
                columnNumber: 7
            }, this),
            inputOcrAvailable && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                label: "Conversion",
                hint: edit ? "Built-in parser at upload, or vision OCR for scans and handwriting" : undefined,
                children: edit ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-3 rounded-md border border-dashed border-chart-3/40 bg-chart-3/5 p-3",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "font-mono text-[10px] text-muted-foreground",
                            children: "Built-in parser runs at upload (PDF.js → docs.content). Vision OCR runs via OpenRouter and is cached separately."
                        }, void 0, false, {
                            fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                            lineNumber: 165,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-wrap gap-1.5",
                            children: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["DOC_PARSE_MODES"].map((mode)=>{
                                const active = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["docParseModeForModule"])(selected) === mode.value;
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>onUpdate({
                                            useOcr: mode.value === "llm" ? true : undefined,
                                            model: mode.value === "llm" ? selected.model ?? "gemini-3-flash" : undefined,
                                            prompt: mode.value === "llm" ? selected.prompt : undefined
                                        }),
                                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-muted-foreground/40"),
                                    title: mode.hint,
                                    children: mode.label
                                }, mode.value, false, {
                                    fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                                    lineNumber: 172,
                                    columnNumber: 21
                                }, this);
                            })
                        }, void 0, false, {
                            fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                            lineNumber: 168,
                            columnNumber: 15
                        }, this),
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["docParseModeForModule"])(selected) === "llm" && onUpdate && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OcrExtraFields"], {
                            selected: selected,
                            edit: !!edit,
                            onUpdate: onUpdate
                        }, void 0, false, {
                            fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                            lineNumber: 196,
                            columnNumber: 17
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                    lineNumber: 164,
                    columnNumber: 13
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StaticValue"], {
                    children: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["DOC_PARSE_MODES"].find((m)=>m.value === (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["docParseModeForModule"])(selected))?.label ?? "Built-in parser"
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                    lineNumber: 200,
                    columnNumber: 13
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                lineNumber: 159,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                label: "Filename must contain",
                hint: edit ? "optional — only documents whose name includes this text can be assigned to this input" : undefined,
                children: edit ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                    value: selected.inputNameContains ?? "",
                    onChange: (e)=>onUpdate({
                            inputNameContains: e.target.value.trim() || undefined
                        }),
                    placeholder: 'e.g. "legal_requirements", "company_legal_compliance"',
                    className: "h-8 font-mono text-xs"
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                    lineNumber: 212,
                    columnNumber: 11
                }, this) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["inputNameRestrictionLabel"])(selected) ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StaticValue"], {
                    mono: true,
                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["inputNameRestrictionLabel"])(selected)
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                    lineNumber: 219,
                    columnNumber: 11
                }, this) : null
            }, void 0, false, {
                fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                lineNumber: 207,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                label: "Multiple documents",
                hint: edit ? "when on, inference lets you add many files and this step emits a list on the pipeline spine" : undefined,
                children: edit ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2.5",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs font-medium",
                                    children: "Emit list output"
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                                    lineNumber: 233,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "font-mono text-[10px] text-muted-foreground",
                                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$spine_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["resolveOutIsList"])(selected) ? "multi-doc slot · list[structure]" : "single-doc slot · one structure"
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                                    lineNumber: 234,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                            lineNumber: 232,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$switch$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Switch"], {
                            checked: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$spine_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["resolveOutIsList"])(selected),
                            onCheckedChange: (v)=>onUpdate({
                                    ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$spine_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["patchSpineOutList"])(selected, v),
                                    inputMinCount: v ? Math.max(2, selected.inputMinCount ?? 1) : undefined
                                })
                        }, void 0, false, {
                            fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                            lineNumber: 240,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                    lineNumber: 231,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StaticValue"], {
                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$spine_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["resolveOutIsList"])(selected) ? "Multi-doc (list)" : "Single-doc"
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                    lineNumber: 251,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                lineNumber: 222,
                columnNumber: 7
            }, this),
            ((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$spine_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["resolveOutIsList"])(selected) || (selected.inputMinCount ?? 1) > 1) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                label: "Minimum documents",
                hint: edit ? "required count when this slot accepts multiple files" : undefined,
                children: edit ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                    type: "number",
                    min: 1,
                    value: selected.inputMinCount ?? ((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$spine_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["resolveOutIsList"])(selected) ? 2 : 1),
                    onChange: (e)=>{
                        const n = Math.max(1, Number.parseInt(e.target.value, 10) || 1);
                        onUpdate({
                            inputMinCount: n === 1 && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$spine_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["resolveOutIsList"])(selected) ? undefined : n
                        });
                    },
                    className: "h-8 font-mono text-xs"
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                    lineNumber: 260,
                    columnNumber: 13
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StaticValue"], {
                    mono: true,
                    children: selected.inputMinCount ?? ((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$spine_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["resolveOutIsList"])(selected) ? 2 : 1)
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                    lineNumber: 271,
                    columnNumber: 13
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                lineNumber: 255,
                columnNumber: 9
            }, this),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$spine_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["resolveOutIsList"])(selected) && selected.outStructureId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                label: "Spine output type",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StaticValue"], {
                    mono: true,
                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$spine_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatModuleSpineOut"])(selected, models)
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                    lineNumber: 277,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                lineNumber: 276,
                columnNumber: 9
            }, this),
            warnings?.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-1",
                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$messages$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["warningStepMessages"])(warnings, models, modules).map((msg, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("font-mono text-[10px] leading-relaxed", __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ui$2d$classes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WARNING_TEXT_CLASS"]),
                        children: msg
                    }, i, false, {
                        fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                        lineNumber: 283,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                lineNumber: 281,
                columnNumber: 9
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                label: "I/O model",
                hint: invalid?.kind === "no-output" ? "required — defines the structure this file is loaded into" : undefined,
                hintTone: invalid?.kind === "no-output" ? "error" : "warning",
                children: [
                    edit ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureModelSelect"], {
                        models: models,
                        value: targetStructureId,
                        onValueChange: (v)=>onUpdate({
                                outStructureId: v
                            }),
                        invalid: invalid?.kind === "no-output"
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                        lineNumber: 297,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StaticValue"], {
                        mono: true,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                            models: models,
                            structureId: targetStructureId
                        }, void 0, false, {
                            fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                            lineNumber: 305,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                        lineNumber: 304,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["IoMismatchFieldFix"], {
                        fix: ioMismatchFix?.kind === "align-upstream" ? ioMismatchFix : undefined,
                        edit: !!edit,
                        onFix: onFixIoMismatch
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                        lineNumber: 308,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/pipeline-fields/input-fields.tsx",
                lineNumber: 289,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true);
}
_c = InputModuleFields;
function toggleInputType(value, active, selected, onUpdate) {
    const current = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["inputTypesForModule"])(selected);
    const next = active ? current.filter((v)=>v !== value) : [
        ...current,
        value
    ];
    if (!next.length) return;
    const spec = next.length === 1 ? next[0] : next;
    const ocrOk = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inference$2d$input$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["inputTypesNeedOcr"])(next);
    onUpdate({
        inputType: spec,
        useOcr: ocrOk ? selected.useOcr : undefined,
        model: ocrOk && selected.useOcr ? selected.model : undefined,
        prompt: ocrOk && selected.useOcr ? selected.prompt : undefined
    });
}
function TypeChip({ label, active, tone, onClick }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        onClick: onClick,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", active ? tone === "json" ? "border-chart-1 bg-chart-1/10 text-chart-1" : "border-chart-3 bg-chart-3/10 text-chart-3" : "border-border text-muted-foreground hover:border-muted-foreground/40"),
        children: label
    }, void 0, false, {
        fileName: "[project]/components/pipeline-fields/input-fields.tsx",
        lineNumber: 349,
        columnNumber: 5
    }, this);
}
_c1 = TypeChip;
var _c, _c1;
__turbopack_context__.k.register(_c, "InputModuleFields");
__turbopack_context__.k.register(_c1, "TypeChip");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/pipeline-fields/llm-fields.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LlmModuleFields",
    ()=>LlmModuleFields
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$highlight$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/highlight.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$model$2d$selector$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/model-selector.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$textarea$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/textarea.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/pipeline-fields/shared.tsx [app-client] (ecmascript)");
"use client";
;
;
;
;
;
function LlmModuleFields({ selected, edit, globalModel, hasNoPromptWarning, llmSchemaPreview, onUpdate }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                label: "Model",
                children: edit ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$model$2d$selector$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ModelSelector"], {
                    value: selected.model ?? globalModel ?? "",
                    onChange: (v)=>onUpdate({
                            model: v
                        })
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-fields/llm-fields.tsx",
                    lineNumber: 31,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StaticValue"], {
                    mono: true,
                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["llmModelLabel"])(selected.model)
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-fields/llm-fields.tsx",
                    lineNumber: 36,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/pipeline-fields/llm-fields.tsx",
                lineNumber: 29,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                label: hasNoPromptWarning ? "Prompt · optional" : "Prompt",
                children: edit ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$textarea$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Textarea"], {
                            value: selected.prompt ?? "",
                            onChange: (e)=>onUpdate({
                                    prompt: e.target.value
                                }),
                            placeholder: "Extra instruction (schema below also guides the model)…",
                            className: "min-h-32 resize-y text-xs leading-relaxed"
                        }, void 0, false, {
                            fileName: "[project]/components/pipeline-fields/llm-fields.tsx",
                            lineNumber: 42,
                            columnNumber: 13
                        }, this),
                        hasNoPromptWarning && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "mt-1 font-mono text-[9px] text-muted-foreground",
                            children: "no custom text — JSON schema is sent as the structured output contract"
                        }, void 0, false, {
                            fileName: "[project]/components/pipeline-fields/llm-fields.tsx",
                            lineNumber: 49,
                            columnNumber: 15
                        }, this)
                    ]
                }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StaticValue"], {
                    mono: true,
                    pre: true,
                    children: selected.prompt?.trim() ? selected.prompt : "—"
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-fields/llm-fields.tsx",
                    lineNumber: 55,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/pipeline-fields/llm-fields.tsx",
                lineNumber: 39,
                columnNumber: 7
            }, this),
            llmSchemaPreview && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                label: selected.kind === "llm-batch" ? "Output schema · per item" : "Output schema · Zod → JSON Schema",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "max-h-64 min-w-0 overflow-auto rounded-md border border-border bg-[oklch(0.14_0.004_264)] p-2",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$highlight$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["JsonHighlight"], {
                        json: llmSchemaPreview
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-fields/llm-fields.tsx",
                        lineNumber: 69,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-fields/llm-fields.tsx",
                    lineNumber: 68,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/pipeline-fields/llm-fields.tsx",
                lineNumber: 61,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true);
}
_c = LlmModuleFields;
var _c;
__turbopack_context__.k.register(_c, "LlmModuleFields");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/custom-code-editor.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CustomCodeEditor",
    ()=>CustomCodeEditor
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// AI : TODO — debounced tryCompileCustomCodeEntry markers in Monaco (computeInvalid already blocks run).
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$maximize$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Maximize2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/maximize-2.mjs [app-client] (ecmascript) <export default as Maximize2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.mjs [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$code$2d$viewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/code-viewer.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
function CustomCodeEditor({ value, onChange, language, readOnly = false, label, className }) {
    _s();
    const [fullscreen, setFullscreen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const closeFullscreen = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "CustomCodeEditor.useCallback[closeFullscreen]": ()=>setFullscreen(false)
    }["CustomCodeEditor.useCallback[closeFullscreen]"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CustomCodeEditor.useEffect": ()=>{
            if (!fullscreen) return;
            const onKey = {
                "CustomCodeEditor.useEffect.onKey": (e)=>{
                    if (e.key === "Escape") closeFullscreen();
                }
            }["CustomCodeEditor.useEffect.onKey"];
            window.addEventListener("keydown", onKey);
            return ({
                "CustomCodeEditor.useEffect": ()=>window.removeEventListener("keydown", onKey)
            })["CustomCodeEditor.useEffect"];
        }
    }["CustomCodeEditor.useEffect"], [
        fullscreen,
        closeFullscreen
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CustomCodeEditor.useEffect": ()=>{
            document.body.style.overflow = fullscreen ? "hidden" : "";
            return ({
                "CustomCodeEditor.useEffect": ()=>{
                    document.body.style.overflow = "";
                }
            })["CustomCodeEditor.useEffect"];
        }
    }["CustomCodeEditor.useEffect"], [
        fullscreen
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            !fullscreen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("relative overflow-hidden rounded-md border border-border bg-[#1e1f23]", className),
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        type: "button",
                        variant: "ghost",
                        size: "icon",
                        className: "absolute right-1 top-1 z-10 h-7 w-7 bg-background/60 text-muted-foreground backdrop-blur-sm hover:text-foreground",
                        onClick: ()=>setFullscreen(true),
                        title: "Open full editor",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$maximize$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Maximize2$3e$__["Maximize2"], {
                            className: "h-3.5 w-3.5"
                        }, void 0, false, {
                            fileName: "[project]/components/custom-code-editor.tsx",
                            lineNumber: 61,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/custom-code-editor.tsx",
                        lineNumber: 53,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$code$2d$viewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MonacoCodeEditor"], {
                        value: value,
                        onChange: onChange,
                        language: language,
                        readOnly: readOnly,
                        compact: true
                    }, void 0, false, {
                        fileName: "[project]/components/custom-code-editor.tsx",
                        lineNumber: 63,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/custom-code-editor.tsx",
                lineNumber: 52,
                columnNumber: 9
            }, this),
            fullscreen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "fixed inset-0 z-50 flex flex-col bg-[#1e1f23]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-2.5",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "min-w-0",
                                children: [
                                    label && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "truncate font-mono text-xs text-foreground",
                                        children: label
                                    }, void 0, false, {
                                        fileName: "[project]/components/custom-code-editor.tsx",
                                        lineNumber: 77,
                                        columnNumber: 25
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "font-mono text-[10px] text-muted-foreground",
                                        children: [
                                            __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$code$2d$viewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CODE_LANG_LABEL"][language],
                                            " · Esc to close"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/custom-code-editor.tsx",
                                        lineNumber: 78,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/custom-code-editor.tsx",
                                lineNumber: 76,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                type: "button",
                                variant: "ghost",
                                size: "icon",
                                className: "ml-auto h-8 w-8 text-muted-foreground hover:text-foreground",
                                onClick: closeFullscreen,
                                title: "Close editor",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                    className: "h-4 w-4"
                                }, void 0, false, {
                                    fileName: "[project]/components/custom-code-editor.tsx",
                                    lineNumber: 90,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/custom-code-editor.tsx",
                                lineNumber: 82,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/custom-code-editor.tsx",
                        lineNumber: 75,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$code$2d$viewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MonacoCodeEditor"], {
                        value: value,
                        onChange: onChange,
                        language: language,
                        readOnly: readOnly
                    }, void 0, false, {
                        fileName: "[project]/components/custom-code-editor.tsx",
                        lineNumber: 93,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/custom-code-editor.tsx",
                lineNumber: 74,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true);
}
_s(CustomCodeEditor, "4h7/5a6rpcIFz5BKVwxIt47QJ4M=");
_c = CustomCodeEditor;
var _c;
__turbopack_context__.k.register(_c, "CustomCodeEditor");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/pipeline-fields/code-fields.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CodeModuleFields",
    ()=>CodeModuleFields
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/plus.mjs [app-client] (ecmascript) <export default as Plus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trash-2.mjs [app-client] (ecmascript) <export default as Trash2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$custom$2d$code$2d$editor$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/custom-code-editor.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/select.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$custom_code_entries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/custom_code_entries.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/pipeline-fields/shared.tsx [app-client] (ecmascript)");
"use client";
;
;
;
;
;
;
;
;
function CodeModuleFields({ selected, edit, onUpdate }) {
    const isAssert = selected.kind === "assert";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
        label: isAssert ? "Assert · step[\"Label\"] + len()" : "Code list · tried in order (first is primary)",
        hint: isAssert ? "auto-placed after the latest referenced step label — passthrough on success" : undefined,
        children: edit ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-2",
            children: [
                (selected.fallbackList ?? []).map((fb, i)=>{
                    const lang = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$custom_code_entries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["languageOfEntry"])(fb);
                    const code = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$custom_code_entries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["codeOfEntry"])(fb);
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-1.5 rounded-md border border-border bg-secondary/20 p-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-mono text-[10px] text-muted-foreground",
                                        children: i === 0 ? "primary" : `fallback ${i}`
                                    }, void 0, false, {
                                        fileName: "[project]/components/pipeline-fields/code-fields.tsx",
                                        lineNumber: 47,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                                        value: lang,
                                        onValueChange: (v)=>{
                                            const next = [
                                                ...selected.fallbackList ?? []
                                            ];
                                            next[i] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$custom_code_entries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["makeCustomCodeEntry"])(v, code);
                                            onUpdate({
                                                fallbackList: next
                                            });
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectTrigger"], {
                                                className: "h-8 w-36 bg-[oklch(0.14_0.004_264)] text-xs",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectValue"], {}, void 0, false, {
                                                    fileName: "[project]/components/pipeline-fields/code-fields.tsx",
                                                    lineNumber: 59,
                                                    columnNumber: 23
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-fields/code-fields.tsx",
                                                lineNumber: 58,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectContent"], {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                                        value: "typescript",
                                                        children: "TypeScript"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/pipeline-fields/code-fields.tsx",
                                                        lineNumber: 62,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                                        value: "python",
                                                        children: "Python"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/pipeline-fields/code-fields.tsx",
                                                        lineNumber: 63,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/pipeline-fields/code-fields.tsx",
                                                lineNumber: 61,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/pipeline-fields/code-fields.tsx",
                                        lineNumber: 50,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        type: "button",
                                        variant: "ghost",
                                        size: "icon",
                                        className: "ml-auto h-8 w-8 text-muted-foreground",
                                        disabled: (selected.fallbackList?.length ?? 0) <= 1,
                                        onClick: ()=>{
                                            const next = (selected.fallbackList ?? []).filter((_, j)=>j !== i);
                                            onUpdate({
                                                fallbackList: next
                                            });
                                        },
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__["Trash2"], {
                                            className: "h-3.5 w-3.5"
                                        }, void 0, false, {
                                            fileName: "[project]/components/pipeline-fields/code-fields.tsx",
                                            lineNumber: 77,
                                            columnNumber: 21
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/components/pipeline-fields/code-fields.tsx",
                                        lineNumber: 66,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/pipeline-fields/code-fields.tsx",
                                lineNumber: 46,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "font-mono text-[10px] text-muted-foreground",
                                children: lang === "python" ? isAssert ? "def transform(input, state=None) — len/step helpers injected" : "def transform(input, state=None)" : isAssert ? "(input, state) => void — step/len helpers injected" : "(input, state) => output"
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-fields/code-fields.tsx",
                                lineNumber: 80,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$custom$2d$code$2d$editor$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CustomCodeEditor"], {
                                value: code,
                                language: lang,
                                label: i === 0 ? "primary" : `fallback ${i}`,
                                onChange: (nextCode)=>{
                                    const next = [
                                        ...selected.fallbackList ?? []
                                    ];
                                    next[i] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$custom_code_entries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["makeCustomCodeEntry"])(lang, nextCode);
                                    onUpdate({
                                        fallbackList: next
                                    });
                                }
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-fields/code-fields.tsx",
                                lineNumber: 89,
                                columnNumber: 17
                            }, this)
                        ]
                    }, i, true, {
                        fileName: "[project]/components/pipeline-fields/code-fields.tsx",
                        lineNumber: 45,
                        columnNumber: 15
                    }, this);
                }),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                    type: "button",
                    variant: "outline",
                    size: "sm",
                    className: "h-8 text-xs",
                    onClick: ()=>{
                        onUpdate({
                            fallbackList: [
                                ...selected.fallbackList ?? [],
                                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$custom_code_entries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["makeCustomCodeEntry"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["CustomCodeLanguage"].TypeScript, "")
                            ]
                        });
                    },
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                            className: "mr-1 h-3.5 w-3.5"
                        }, void 0, false, {
                            fileName: "[project]/components/pipeline-fields/code-fields.tsx",
                            lineNumber: 113,
                            columnNumber: 13
                        }, this),
                        "Add fallback"
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/pipeline-fields/code-fields.tsx",
                    lineNumber: 102,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/pipeline-fields/code-fields.tsx",
            lineNumber: 40,
            columnNumber: 9
        }, this) : (selected.fallbackList?.length ?? 0) > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-2",
            children: selected.fallbackList.map((fb, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded-md border border-border bg-secondary/20 p-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "mb-1 font-mono text-[10px] text-muted-foreground",
                            children: [
                                i === 0 ? "primary" : `fallback ${i}`,
                                " · ",
                                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$custom_code_entries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["languageOfEntry"])(fb)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/pipeline-fields/code-fields.tsx",
                            lineNumber: 121,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$custom$2d$code$2d$editor$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CustomCodeEditor"], {
                            value: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$custom_code_entries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["codeOfEntry"])(fb),
                            language: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$custom_code_entries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["languageOfEntry"])(fb),
                            readOnly: true
                        }, void 0, false, {
                            fileName: "[project]/components/pipeline-fields/code-fields.tsx",
                            lineNumber: 124,
                            columnNumber: 15
                        }, this)
                    ]
                }, i, true, {
                    fileName: "[project]/components/pipeline-fields/code-fields.tsx",
                    lineNumber: 120,
                    columnNumber: 13
                }, this))
        }, void 0, false, {
            fileName: "[project]/components/pipeline-fields/code-fields.tsx",
            lineNumber: 118,
            columnNumber: 9
        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StaticValue"], {
            children: "None"
        }, void 0, false, {
            fileName: "[project]/components/pipeline-fields/code-fields.tsx",
            lineNumber: 133,
            columnNumber: 9
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/pipeline-fields/code-fields.tsx",
        lineNumber: 31,
        columnNumber: 5
    }, this);
}
_c = CodeModuleFields;
var _c;
__turbopack_context__.k.register(_c, "CodeModuleFields");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/pipeline-module-fields.tsx [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PipelineModuleFields",
    ()=>PipelineModuleFields
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ui$2d$classes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/ui-classes.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$textarea$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/textarea.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$switch$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/switch.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$quote$2d$steps$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/quote-steps.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/validity-sync.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$parse$2d$steps$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/structure-parse-steps.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$kinds$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/module-kinds.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$spine$2d$type$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/spine-type.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$spine_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/spine_types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$validity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/validity.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$messages$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/validity-messages.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/structure-link.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$logging$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/logging-settings.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$use$2d$browser$2d$pref$2d$event$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/use-browser-pref-event.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/pipeline-fields/shared.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$input$2d$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/pipeline-fields/input-fields.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$llm$2d$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/pipeline-fields/llm-fields.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$code$2d$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/pipeline-fields/code-fields.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
function PipelineModuleFields({ module: selected, models, typeAliases = [], modules, mode, globalModel, invalid, invalidIssues, warnings, ioMismatchFix, onUpdate, onFixIoMismatch }) {
    _s();
    const llmSchemaPreview = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLlmSchemaPreview"])(selected, models, typeAliases);
    const edit = mode === "edit" && onUpdate;
    const requireInputDescriptions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$use$2d$browser$2d$pref$2d$event$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useBrowserPrefEvent"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$logging$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LOGGING_SETTINGS_CHANGED_EVENT"], __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$logging$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readRequireInputDescriptions"]);
    const hasNoPromptWarning = warnings?.some((w)=>w.kind === "no-prompt");
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isAutoQuoteStep"])(selected)) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "mb-3 font-mono text-[10px] leading-relaxed text-muted-foreground",
                    children: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AUTO_QUOTE_EXPLAINER"]
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-module-fields.tsx",
                    lineNumber: 85,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                    label: "Structure",
                    children: edit ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "rounded-md border border-chart-2/30 bg-chart-2/5 px-2.5 py-2 font-mono text-xs",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                                models: models,
                                structureId: selected.inStructureId
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-module-fields.tsx",
                                lineNumber: 89,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-muted-foreground",
                                children: " → "
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-module-fields.tsx",
                                lineNumber: 90,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                                models: models,
                                structureId: selected.outStructureId
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-module-fields.tsx",
                                lineNumber: 91,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "mt-1 block font-mono text-[10px] text-muted-foreground",
                                children: "same model — LLM emits strings, this step attaches source spans"
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-module-fields.tsx",
                                lineNumber: 92,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/pipeline-module-fields.tsx",
                        lineNumber: 88,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StaticValue"], {
                        mono: true,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                                models: models,
                                structureId: selected.inStructureId
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-module-fields.tsx",
                                lineNumber: 98,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-muted-foreground",
                                children: " → "
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-module-fields.tsx",
                                lineNumber: 99,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                                models: models,
                                structureId: selected.outStructureId
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-module-fields.tsx",
                                lineNumber: 100,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "mt-1 block font-mono text-[10px] text-muted-foreground",
                                children: "same model — LLM emits strings, this step attaches source spans"
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-module-fields.tsx",
                                lineNumber: 101,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/pipeline-module-fields.tsx",
                        lineNumber: 97,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-module-fields.tsx",
                    lineNumber: 86,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true);
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isAutoStructureParseStep"])(selected)) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "mb-3 font-mono text-[10px] leading-relaxed text-muted-foreground",
                    children: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AUTO_STRUCTURE_PARSE_EXPLAINER"]
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-module-fields.tsx",
                    lineNumber: 114,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                    label: "Structure",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StaticValue"], {
                        mono: true,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                                models: models,
                                structureId: selected.inStructureId
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-module-fields.tsx",
                                lineNumber: 119,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-muted-foreground",
                                children: " → "
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-module-fields.tsx",
                                lineNumber: 120,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                                models: models,
                                structureId: selected.outStructureId
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-module-fields.tsx",
                                lineNumber: 121,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/pipeline-module-fields.tsx",
                        lineNumber: 118,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-module-fields.tsx",
                    lineNumber: 117,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$llm$2d$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LlmModuleFields"], {
                    selected: selected,
                    models: models,
                    edit: false,
                    globalModel: globalModel,
                    hasNoPromptWarning: !!hasNoPromptWarning,
                    llmSchemaPreview: llmSchemaPreview
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-module-fields.tsx",
                    lineNumber: 124,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mb-3 font-mono text-[10px] leading-relaxed text-muted-foreground",
                children: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["MODULE_META"][selected.kind].description
            }, void 0, false, {
                fileName: "[project]/components/pipeline-module-fields.tsx",
                lineNumber: 138,
                columnNumber: 7
            }, this),
            (invalidIssues ?? (invalid ? [
                invalid
            ] : [])).filter((issue)=>issue.kind !== "io-mismatch" && issue.kind !== "cardinality-mismatch").map((issue, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "mb-3 font-mono text-[10px] leading-relaxed text-destructive",
                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$messages$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["invalidStepMessage"])(issue, models, modules)
                }, i, false, {
                    fileName: "[project]/components/pipeline-module-fields.tsx",
                    lineNumber: 144,
                    columnNumber: 11
                }, this)),
            selected.kind !== "input" && warnings?.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-3 space-y-1",
                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$messages$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["warningStepMessages"])(warnings, models, modules).map((msg, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("font-mono text-[10px] leading-relaxed", __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ui$2d$classes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WARNING_TEXT_CLASS"]),
                        children: msg
                    }, i, false, {
                        fileName: "[project]/components/pipeline-module-fields.tsx",
                        lineNumber: 151,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/components/pipeline-module-fields.tsx",
                lineNumber: 149,
                columnNumber: 9
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                label: "Label",
                children: edit ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                    value: selected.label,
                    onChange: (e)=>onUpdate({
                            label: e.target.value
                        }),
                    className: "h-8 text-sm"
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-module-fields.tsx",
                    lineNumber: 160,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StaticValue"], {
                    children: selected.label
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-module-fields.tsx",
                    lineNumber: 166,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/pipeline-module-fields.tsx",
                lineNumber: 158,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                label: "Input description",
                hint: edit ? requireInputDescriptions ? "required — describe what data this step expects" : "optional — an LLM check can reject step input that doesn't match before processing" : undefined,
                children: edit ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$textarea$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Textarea"], {
                    value: selected.inputDescription ?? "",
                    onChange: (e)=>onUpdate({
                            inputDescription: e.target.value === "" ? undefined : e.target.value
                        }),
                    onBlur: (e)=>{
                        const trimmed = e.target.value.trim();
                        const current = selected.inputDescription ?? "";
                        if (trimmed !== current) onUpdate({
                            inputDescription: trimmed || undefined
                        });
                    },
                    placeholder: 'e.g. "A signed W-2 wage statement for tax year 2024"',
                    className: "min-h-[72px] font-mono text-xs"
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-module-fields.tsx",
                    lineNumber: 181,
                    columnNumber: 11
                }, this) : selected.inputDescription?.trim() ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StaticValue"], {
                    children: selected.inputDescription
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-module-fields.tsx",
                    lineNumber: 195,
                    columnNumber: 11
                }, this) : null
            }, void 0, false, {
                fileName: "[project]/components/pipeline-module-fields.tsx",
                lineNumber: 170,
                columnNumber: 7
            }, this),
            edit && selected.inputDescription?.trim() ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                label: "Validate input",
                hint: "LLM input check before this step runs — billed to your account",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center gap-2.5",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$switch$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Switch"], {
                            checked: selected.checkInputDescription !== false,
                            onCheckedChange: (checked)=>onUpdate({
                                    checkInputDescription: checked ? undefined : false
                                })
                        }, void 0, false, {
                            fileName: "[project]/components/pipeline-module-fields.tsx",
                            lineNumber: 205,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "font-mono text-[10px] text-muted-foreground",
                            children: selected.checkInputDescription !== false ? "On — rejects mismatched input before processing" : "Off — description stored only, no LLM check"
                        }, void 0, false, {
                            fileName: "[project]/components/pipeline-module-fields.tsx",
                            lineNumber: 211,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/pipeline-module-fields.tsx",
                    lineNumber: 204,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/pipeline-module-fields.tsx",
                lineNumber: 200,
                columnNumber: 9
            }, this) : !edit && selected.inputDescription?.trim() ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                label: "Validate input",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StaticValue"], {
                    children: selected.checkInputDescription !== false ? "On" : "Off"
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-module-fields.tsx",
                    lineNumber: 220,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/pipeline-module-fields.tsx",
                lineNumber: 219,
                columnNumber: 9
            }, this) : null,
            (selected.kind === "input" || selected.kind === "combine" || (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$kinds$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isLlmKind"])(selected.kind)) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                label: "Annotation / purpose",
                hint: edit ? "required — describe what this step does or handles" : undefined,
                hintTone: edit && (invalidIssues ?? (invalid ? [
                    invalid
                ] : [])).some((issue)=>issue.kind === "missing-note") ? "error" : undefined,
                children: edit ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                    value: selected.note,
                    onChange: (e)=>onUpdate({
                            note: e.target.value
                        }),
                    onBlur: (e)=>{
                        const trimmed = e.target.value.trim();
                        if (trimmed !== selected.note) onUpdate({
                            note: trimmed
                        });
                    },
                    placeholder: "describe what this step does…",
                    className: "h-8 text-xs"
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-module-fields.tsx",
                    lineNumber: 237,
                    columnNumber: 13
                }, this) : selected.note.trim() ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StaticValue"], {
                    children: selected.note
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-module-fields.tsx",
                    lineNumber: 248,
                    columnNumber: 13
                }, this) : null
            }, void 0, false, {
                fileName: "[project]/components/pipeline-module-fields.tsx",
                lineNumber: 227,
                columnNumber: 9
            }, this),
            selected.kind === "input" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$input$2d$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["InputModuleFields"], {
                selected: selected,
                models: models,
                modules: modules,
                edit: !!edit,
                invalid: invalid,
                warnings: warnings,
                ioMismatchFix: ioMismatchFix,
                onUpdate: onUpdate,
                onFixIoMismatch: onFixIoMismatch
            }, void 0, false, {
                fileName: "[project]/components/pipeline-module-fields.tsx",
                lineNumber: 254,
                columnNumber: 9
            }, this),
            selected.kind !== "input" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                label: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$kinds$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usesPassthroughStructure"])(selected.kind) ? "Structure to materialize" : "Input model",
                hint: selected.kind === "output" && invalid?.kind === "no-output" ? "required — pick the structure this step snapshots" : selected.kind === "assert" && invalid?.kind === "no-output" ? "required — passthrough structure (matches upstream)" : selected.kind === "human-review" && invalid?.kind === "no-output" ? "required — data shape shown for review (matches upstream)" : selected.kind === "human-review" ? "pipeline pauses in Inference — approve to continue or reject to stop" : undefined,
                hintTone: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$kinds$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usesPassthroughStructure"])(selected.kind) ? invalid?.kind === "no-output" ? "error" : "warning" : "warning",
                children: [
                    edit ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureModelSelect"], {
                        models: models,
                        value: selected.inStructureId,
                        onValueChange: (v)=>onUpdate({
                                inStructureId: v
                            }),
                        invalid: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$kinds$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usesPassthroughStructure"])(selected.kind) && invalid?.kind === "no-output"
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-module-fields.tsx",
                        lineNumber: 284,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StaticValue"], {
                        mono: true,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                            models: models,
                            structureId: selected.inStructureId
                        }, void 0, false, {
                            fileName: "[project]/components/pipeline-module-fields.tsx",
                            lineNumber: 292,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-module-fields.tsx",
                        lineNumber: 291,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["IoMismatchFieldFix"], {
                        fix: ioMismatchFix && (ioMismatchFix.kind === "adopt-upstream" || selected.kind === "output" && ioMismatchFix.kind === "align-upstream") ? ioMismatchFix : undefined,
                        edit: !!edit,
                        onFix: onFixIoMismatch
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-module-fields.tsx",
                        lineNumber: 295,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/pipeline-module-fields.tsx",
                lineNumber: 268,
                columnNumber: 9
            }, this),
            selected.kind !== "input" && selected.kind !== "output" && selected.kind !== "human-review" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                label: "Output model",
                hint: invalid?.kind === "no-output" ? "required — step must emit a structure" : undefined,
                hintTone: invalid?.kind === "no-output" ? "error" : "warning",
                children: [
                    edit ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureModelSelect"], {
                        models: models,
                        value: selected.outStructureId,
                        onValueChange: (v)=>onUpdate({
                                outStructureId: v
                            }),
                        invalid: invalid?.kind === "no-output"
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-module-fields.tsx",
                        lineNumber: 316,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StaticValue"], {
                        mono: true,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureLink"], {
                            models: models,
                            structureId: selected.outStructureId
                        }, void 0, false, {
                            fileName: "[project]/components/pipeline-module-fields.tsx",
                            lineNumber: 324,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-module-fields.tsx",
                        lineNumber: 323,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["IoMismatchFieldFix"], {
                        fix: ioMismatchFix?.kind === "align-upstream" ? ioMismatchFix : undefined,
                        edit: !!edit,
                        onFix: onFixIoMismatch
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-module-fields.tsx",
                        lineNumber: 327,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/pipeline-module-fields.tsx",
                lineNumber: 310,
                columnNumber: 9
            }, this),
            selected.kind !== "input" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineField"], {
                label: "Spine types",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StaticValue"], {
                    mono: true,
                    children: [
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$spine_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatModuleSpineIn"])(selected, models),
                        " → ",
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$spine_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatModuleSpineOut"])(selected, models)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/pipeline-module-fields.tsx",
                    lineNumber: 337,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/pipeline-module-fields.tsx",
                lineNumber: 336,
                columnNumber: 9
            }, this),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$kinds$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isLlmKind"])(selected.kind) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$llm$2d$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LlmModuleFields"], {
                selected: selected,
                models: models,
                edit: !!edit,
                globalModel: globalModel,
                hasNoPromptWarning: !!hasNoPromptWarning,
                llmSchemaPreview: llmSchemaPreview,
                onUpdate: onUpdate
            }, void 0, false, {
                fileName: "[project]/components/pipeline-module-fields.tsx",
                lineNumber: 344,
                columnNumber: 9
            }, this),
            (selected.kind === "custom-code" || selected.kind === "assert") && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$code$2d$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CodeModuleFields"], {
                selected: selected,
                edit: !!edit,
                onUpdate: onUpdate
            }, void 0, false, {
                fileName: "[project]/components/pipeline-module-fields.tsx",
                lineNumber: 356,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true);
}
_s(PipelineModuleFields, "OLd8TrtnFGg3Vol7pCQbktDtxpI=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$fields$2f$shared$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLlmSchemaPreview"],
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$use$2d$browser$2d$pref$2d$event$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useBrowserPrefEvent"]
    ];
});
_c = PipelineModuleFields;
var _c;
__turbopack_context__.k.register(_c, "PipelineModuleFields");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/format.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// AI : shared display formatters for cents and latency.
__turbopack_context__.s([
    "formatCents",
    ()=>formatCents,
    "formatCostCents",
    ()=>formatCostCents,
    "formatMs",
    ()=>formatMs,
    "formatSecondsShort",
    ()=>formatSecondsShort,
    "formatUsdFromCents",
    ()=>formatUsdFromCents
]);
// AI : cents stored to ≤6 dp — USD needs ≤8 dp after ÷100; trim trailing zeros only (no rounding).
const MAX_USD_FRACTION_DIGITS = 8;
function usdStringFromCents(cents) {
    const usd = cents / 100;
    return usd.toFixed(MAX_USD_FRACTION_DIGITS).replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "").replace(/\.$/, "");
}
function formatCents(cents) {
    if (!Number.isFinite(cents) || cents <= 0) return "$0.00";
    return `$${usdStringFromCents(cents)}`;
}
function formatUsdFromCents(cents) {
    return formatCents(cents);
}
function formatCostCents(cents) {
    return formatCents(cents);
}
function formatSecondsShort(ms) {
    return `${(ms / 1000).toFixed(1)}s`;
}
function formatMs(n) {
    if (n >= 60000) return `${(n / 60000).toFixed(1)}m`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}s`;
    return `${Math.round(n)}ms`;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/ui/tooltip.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Tooltip",
    ()=>Tooltip,
    "TooltipContent",
    ()=>TooltipContent,
    "TooltipProvider",
    ()=>TooltipProvider,
    "TooltipTrigger",
    ()=>TooltipTrigger
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$tooltip$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Tooltip$3e$__ = __turbopack_context__.i("[project]/node_modules/@base-ui/react/esm/tooltip/index.parts.js [app-client] (ecmascript) <export * as Tooltip>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
"use client";
;
;
;
function TooltipProvider({ delay = 0, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$tooltip$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Tooltip$3e$__["Tooltip"].Provider, {
        "data-slot": "tooltip-provider",
        delay: delay,
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/tooltip.tsx",
        lineNumber: 12,
        columnNumber: 5
    }, this);
}
_c = TooltipProvider;
function Tooltip({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$tooltip$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Tooltip$3e$__["Tooltip"].Root, {
        "data-slot": "tooltip",
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/tooltip.tsx",
        lineNumber: 21,
        columnNumber: 10
    }, this);
}
_c1 = Tooltip;
function TooltipTrigger({ ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$tooltip$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Tooltip$3e$__["Tooltip"].Trigger, {
        "data-slot": "tooltip-trigger",
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/tooltip.tsx",
        lineNumber: 25,
        columnNumber: 10
    }, this);
}
_c2 = TooltipTrigger;
function TooltipContent({ className, side = "top", sideOffset = 4, align = "center", alignOffset = 0, children, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$tooltip$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Tooltip$3e$__["Tooltip"].Portal, {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$tooltip$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Tooltip$3e$__["Tooltip"].Positioner, {
            align: align,
            alignOffset: alignOffset,
            side: side,
            sideOffset: sideOffset,
            className: "isolate z-50",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$tooltip$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Tooltip$3e$__["Tooltip"].Popup, {
                "data-slot": "tooltip-content",
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className),
                ...props,
                children: [
                    children,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$base$2d$ui$2f$react$2f$esm$2f$tooltip$2f$index$2e$parts$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__Tooltip$3e$__["Tooltip"].Arrow, {
                        className: "z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5"
                    }, void 0, false, {
                        fileName: "[project]/components/ui/tooltip.tsx",
                        lineNumber: 59,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/ui/tooltip.tsx",
                lineNumber: 50,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/components/ui/tooltip.tsx",
            lineNumber: 43,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/ui/tooltip.tsx",
        lineNumber: 42,
        columnNumber: 5
    }, this);
}
_c3 = TooltipContent;
;
var _c, _c1, _c2, _c3;
__turbopack_context__.k.register(_c, "TooltipProvider");
__turbopack_context__.k.register(_c1, "Tooltip");
__turbopack_context__.k.register(_c2, "TooltipTrigger");
__turbopack_context__.k.register(_c3, "TooltipContent");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/download-blob.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "downloadBlob",
    ()=>downloadBlob
]);
function downloadBlob(filename, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([
        content
    ], {
        type: mime
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/pipeline-export-dialog.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PipelineExportDialog",
    ()=>PipelineExportDialog
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// AI : TODO export UI — zip download (single archive) instead of sequential downloadBlob calls.
// AI : TODO export UI — bundled Supabase SQL + Next.js inference shell alongside connector files.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/triangle-alert.mjs [app-client] (ecmascript) <export default as AlertTriangle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/check.mjs [app-client] (ecmascript) <export default as Check>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$code$2d$xml$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Code2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/code-xml.mjs [app-client] (ecmascript) <export default as Code2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/download.mjs [app-client] (ecmascript) <export default as Download>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/file-text.mjs [app-client] (ecmascript) <export default as FileText>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.mjs [app-client] (ecmascript) <export default as Loader2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.mjs [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$code$2d$viewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/code-viewer.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ui$2d$timing$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/ui-timing.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$download$2d$blob$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/download-blob.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
function projectSlug(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "pipeline";
}
const TAB_ORDER = [
    "typescript",
    "python",
    "proto",
    "ui",
    "connector-ts",
    "connector-py",
    "env",
    "requirements",
    "setup"
];
function setupFileTabMeta(filename) {
    switch(filename){
        case ".env.example":
            return {
                id: "env",
                label: ".env.example",
                language: "plaintext"
            };
        case "requirements.txt":
            return {
                id: "requirements",
                label: "requirements.txt",
                language: "plaintext"
            };
        case "SETUP.md":
            return {
                id: "setup",
                label: "SETUP.md",
                language: "markdown"
            };
        case "pipeline_connector.proto":
            return {
                id: "proto",
                label: "connector.proto",
                language: "plaintext"
            };
        case "inference_ui.html":
            return {
                id: "ui",
                label: "inference UI",
                language: "plaintext"
            };
        case "connector_server.ts":
            return {
                id: "connector-ts",
                label: "connector (TS)",
                language: "typescript"
            };
        case "connector_server.py":
            return {
                id: "connector-py",
                label: "connector (Py)",
                language: "python"
            };
        default:
            return {
                id: "setup",
                label: filename,
                language: "plaintext"
            };
    }
}
function PipelineExportDialog({ project, modules, models, typeAliases }) {
    _s();
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [tab, setTab] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("typescript");
    const [downloaded, setDownloaded] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [genError, setGenError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [files, setFiles] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const exportProject = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PipelineExportDialog.useMemo[exportProject]": ()=>({
                ...project,
                modules,
                models,
                typeAliases
            })
    }["PipelineExportDialog.useMemo[exportProject]"], [
        project,
        modules,
        models,
        typeAliases
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PipelineExportDialog.useEffect": ()=>{
            if (!open) return;
            let cancelled = false;
            setLoading(true);
            setGenError(null);
            void ({
                "PipelineExportDialog.useEffect": async ()=>{
                    try {
                        const { generatePipelineSourceTs } = await __turbopack_context__.A("[project]/lib/server/pipeline_ts_export.ts [app-client] (ecmascript, async loader)");
                        const { generatePipelineSourcePy } = await __turbopack_context__.A("[project]/lib/server/pipeline_py_export.ts [app-client] (ecmascript, async loader)");
                        const { generatePipelineSetupFiles, assertNoSecretValuesInExport } = await __turbopack_context__.A("[project]/lib/server/pipeline_export_setup.ts [app-client] (ecmascript, async loader)");
                        const { generatePipelineConnectorFiles } = await __turbopack_context__.A("[project]/lib/server/pipeline_export_connector.ts [app-client] (ecmascript, async loader)");
                        const slug = projectSlug(project.name);
                        const setupFiles = generatePipelineSetupFiles(exportProject);
                        const connectorFiles = generatePipelineConnectorFiles(exportProject);
                        for (const f of connectorFiles)assertNoSecretValuesInExport(f.content);
                        const next = [
                            {
                                id: "typescript",
                                label: "TypeScript",
                                filename: `${slug}_pipeline.ts`,
                                content: generatePipelineSourceTs(exportProject),
                                mime: "text/typescript",
                                language: "typescript"
                            },
                            {
                                id: "python",
                                label: "Python",
                                filename: `${slug}_pipeline.py`,
                                content: generatePipelineSourcePy(exportProject),
                                mime: "text/x-python",
                                language: "python"
                            },
                            ...setupFiles.map({
                                "PipelineExportDialog.useEffect": (f)=>{
                                    const meta = setupFileTabMeta(f.filename);
                                    return {
                                        id: meta.id,
                                        label: meta.label,
                                        filename: f.filename,
                                        content: f.content,
                                        mime: f.mime,
                                        language: meta.language
                                    };
                                }
                            }["PipelineExportDialog.useEffect"]),
                            ...connectorFiles.map({
                                "PipelineExportDialog.useEffect": (f)=>{
                                    const meta = setupFileTabMeta(f.filename);
                                    return {
                                        id: meta.id,
                                        label: meta.label,
                                        filename: f.filename,
                                        content: f.content,
                                        mime: f.mime,
                                        language: meta.language
                                    };
                                }
                            }["PipelineExportDialog.useEffect"])
                        ];
                        if (!cancelled) setFiles(next);
                    } catch (e) {
                        if (!cancelled) {
                            setFiles([]);
                            setGenError(e.message);
                        }
                    } finally{
                        if (!cancelled) setLoading(false);
                    }
                }
            })["PipelineExportDialog.useEffect"]();
            return ({
                "PipelineExportDialog.useEffect": ()=>{
                    cancelled = true;
                }
            })["PipelineExportDialog.useEffect"];
        }
    }["PipelineExportDialog.useEffect"], [
        open,
        exportProject,
        project.name
    ]);
    const active = files.find((f)=>f.id === tab) ?? files[0];
    const lineCount = active?.content.split("\n").length ?? 0;
    const previewLanguage = active?.language === "typescript" || active?.language === "python" ? active.language : "plaintext";
    function downloadFile(file) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$download$2d$blob$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["downloadBlob"])(file.filename, file.content, file.mime);
        setDownloaded(file.filename);
        setTimeout(()=>setDownloaded(null), __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ui$2d$timing$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["COPY_FEEDBACK_MS"]);
    }
    function downloadAll() {
        // AI : TODO export UI — bundle files into one .zip (JSZip or server route).
        for (const file of files)(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$download$2d$blob$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["downloadBlob"])(file.filename, file.content, file.mime);
        setDownloaded("__all__");
        setTimeout(()=>setDownloaded(null), __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ui$2d$timing$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["COPY_FEEDBACK_MS"]);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                variant: "outline",
                size: "sm",
                className: "h-7 gap-1.5 text-[10px]",
                onClick: ()=>setOpen((o)=>!o),
                title: "View and download pipeline code + setup files",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$code$2d$xml$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Code2$3e$__["Code2"], {
                        className: "h-3.5 w-3.5"
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-export-dialog.tsx",
                        lineNumber: 201,
                        columnNumber: 9
                    }, this),
                    "Export code"
                ]
            }, void 0, true, {
                fileName: "[project]/components/pipeline-export-dialog.tsx",
                lineNumber: 194,
                columnNumber: 7
            }, this),
            open && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute right-0 top-full z-50 mt-2 flex w-[min(44rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-xl",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-start justify-between gap-3 border-b border-border px-4 py-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm font-semibold",
                                        children: "Pipeline export"
                                    }, void 0, false, {
                                        fileName: "[project]/components/pipeline-export-dialog.tsx",
                                        lineNumber: 209,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-0.5 text-xs text-muted-foreground",
                                        children: "Pipeline code, gRPC connector, inference UI, and setup files. No secrets in generated code — wire env in your runner."
                                    }, void 0, false, {
                                        fileName: "[project]/components/pipeline-export-dialog.tsx",
                                        lineNumber: 210,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/pipeline-export-dialog.tsx",
                                lineNumber: 208,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                variant: "ghost",
                                size: "icon-sm",
                                onClick: ()=>setOpen(false),
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                    className: "h-3.5 w-3.5"
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-export-dialog.tsx",
                                    lineNumber: 215,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-export-dialog.tsx",
                                lineNumber: 214,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/pipeline-export-dialog.tsx",
                        lineNumber: 207,
                        columnNumber: 11
                    }, this),
                    genError ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__["AlertTriangle"], {
                                className: "mt-0.5 h-3.5 w-3.5 shrink-0"
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-export-dialog.tsx",
                                lineNumber: 221,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                children: genError
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-export-dialog.tsx",
                                lineNumber: 222,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/pipeline-export-dialog.tsx",
                        lineNumber: 220,
                        columnNumber: 13
                    }, this) : loading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-center gap-2 px-4 py-16 font-mono text-xs text-muted-foreground",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                className: "h-4 w-4 animate-spin"
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-export-dialog.tsx",
                                lineNumber: 226,
                                columnNumber: 15
                            }, this),
                            "Generating export…"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/pipeline-export-dialog.tsx",
                        lineNumber: 225,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-wrap rounded-md border border-border p-0.5",
                                        children: TAB_ORDER.map((id)=>{
                                            const file = files.find((f)=>f.id === id);
                                            if (!file) return null;
                                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>setTab(id),
                                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("rounded px-2 py-1 font-mono text-[10px] transition-colors", tab === id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"),
                                                children: file.label
                                            }, id, false, {
                                                fileName: "[project]/components/pipeline-export-dialog.tsx",
                                                lineNumber: 237,
                                                columnNumber: 23
                                            }, this);
                                        })
                                    }, void 0, false, {
                                        fileName: "[project]/components/pipeline-export-dialog.tsx",
                                        lineNumber: 232,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-mono text-[10px] text-muted-foreground",
                                        children: [
                                            lineCount,
                                            " lines"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/pipeline-export-dialog.tsx",
                                        lineNumber: 253,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/pipeline-export-dialog.tsx",
                                lineNumber: 231,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "h-[min(28rem,50vh)] min-h-48",
                                children: active && tab === "ui" ? // AI : TODO security — sandbox allow-scripts runs export HTML in-browser; downloaded
                                // AI : inference_ui.html executes arbitrary JS when opened locally — document risk.
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("iframe", {
                                    title: "Inference UI preview",
                                    srcDoc: active.content,
                                    className: "h-full w-full border-0 bg-background",
                                    sandbox: "allow-scripts"
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-export-dialog.tsx",
                                    lineNumber: 260,
                                    columnNumber: 19
                                }, this) : active ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$code$2d$viewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ReadonlyCodeViewer"], {
                                    value: active.content,
                                    language: previewLanguage,
                                    filename: active.filename,
                                    badge: "read-only",
                                    className: "h-full"
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-export-dialog.tsx",
                                    lineNumber: 267,
                                    columnNumber: 19
                                }, this) : null
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-export-dialog.tsx",
                                lineNumber: 256,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"], {
                                                className: "h-3 w-3"
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-export-dialog.tsx",
                                                lineNumber: 279,
                                                columnNumber: 19
                                            }, this),
                                            files.length,
                                            " files · start with SETUP.md · open inference_ui.html against connector"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/pipeline-export-dialog.tsx",
                                        lineNumber: 278,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-wrap items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                variant: "outline",
                                                size: "sm",
                                                className: "h-8 gap-1.5 font-mono text-[10px]",
                                                disabled: !files.length,
                                                onClick: downloadAll,
                                                children: [
                                                    downloaded === "__all__" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                                                        className: "h-3 w-3"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/pipeline-export-dialog.tsx",
                                                        lineNumber: 291,
                                                        columnNumber: 23
                                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__["Download"], {
                                                        className: "h-3.5 w-3.5"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/pipeline-export-dialog.tsx",
                                                        lineNumber: 293,
                                                        columnNumber: 23
                                                    }, this),
                                                    downloaded === "__all__" ? "Downloaded" : "Download all"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/pipeline-export-dialog.tsx",
                                                lineNumber: 283,
                                                columnNumber: 19
                                            }, this),
                                            active && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                size: "sm",
                                                className: "h-8 gap-1.5 font-mono text-[10px]",
                                                disabled: !files.length,
                                                onClick: ()=>downloadFile(active),
                                                children: [
                                                    downloaded === active.filename ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                                                        className: "h-3 w-3"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/pipeline-export-dialog.tsx",
                                                        lineNumber: 305,
                                                        columnNumber: 25
                                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__["Download"], {
                                                        className: "h-3.5 w-3.5"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/pipeline-export-dialog.tsx",
                                                        lineNumber: 307,
                                                        columnNumber: 25
                                                    }, this),
                                                    downloaded === active.filename ? "Downloaded" : `Download ${active.filename}`
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/pipeline-export-dialog.tsx",
                                                lineNumber: 298,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/pipeline-export-dialog.tsx",
                                        lineNumber: 282,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/pipeline-export-dialog.tsx",
                                lineNumber: 277,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true)
                ]
            }, void 0, true, {
                fileName: "[project]/components/pipeline-export-dialog.tsx",
                lineNumber: 206,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/pipeline-export-dialog.tsx",
        lineNumber: 193,
        columnNumber: 5
    }, this);
}
_s(PipelineExportDialog, "65nJVZEOX0rN05ZFHU8F1x2G3z8=");
_c = PipelineExportDialog;
var _c;
__turbopack_context__.k.register(_c, "PipelineExportDialog");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/editor-split-settings.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEFAULT_PIPELINE_CANVAS_WIDTH",
    ()=>DEFAULT_PIPELINE_CANVAS_WIDTH,
    "DEFAULT_STRUCTURE_SIDEBAR_WIDTH",
    ()=>DEFAULT_STRUCTURE_SIDEBAR_WIDTH,
    "PIPELINE_CANVAS_MAX",
    ()=>PIPELINE_CANVAS_MAX,
    "PIPELINE_CANVAS_MIN",
    ()=>PIPELINE_CANVAS_MIN,
    "STRUCTURE_SIDEBAR_MAX",
    ()=>STRUCTURE_SIDEBAR_MAX,
    "STRUCTURE_SIDEBAR_MIN",
    ()=>STRUCTURE_SIDEBAR_MIN,
    "readPipelineCanvasWidth",
    ()=>readPipelineCanvasWidth,
    "readStructureSidebarWidth",
    ()=>readStructureSidebarWidth,
    "usePipelineCanvasWidth",
    ()=>usePipelineCanvasWidth,
    "useStructureSidebarWidth",
    ()=>useStructureSidebarWidth,
    "writePipelineCanvasWidth",
    ()=>writePipelineCanvasWidth,
    "writeStructureSidebarWidth",
    ()=>writeStructureSidebarWidth
]);
// AI : re-exports — prefer @/lib/layout-split-settings for new code.
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$layout$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/layout-split-settings.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
;
;
const STRUCTURE_SIDEBAR_MIN = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$layout$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["structureSidebarSplit"].min;
const STRUCTURE_SIDEBAR_MAX = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$layout$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["structureSidebarSplit"].max;
const DEFAULT_STRUCTURE_SIDEBAR_WIDTH = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$layout$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["structureSidebarSplit"].defaultWidth;
const readStructureSidebarWidth = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$layout$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["structureSidebarSplit"].read;
const writeStructureSidebarWidth = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$layout$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["structureSidebarSplit"].write;
const PIPELINE_CANVAS_MIN = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$layout$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pipelineCanvasSplit"].min;
const PIPELINE_CANVAS_MAX = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$layout$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pipelineCanvasSplit"].max;
const DEFAULT_PIPELINE_CANVAS_WIDTH = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$layout$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pipelineCanvasSplit"].defaultWidth;
const readPipelineCanvasWidth = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$layout$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pipelineCanvasSplit"].read;
const writePipelineCanvasWidth = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$layout$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pipelineCanvasSplit"].write;
function useStructureSidebarWidth() {
    _s();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$layout$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLayoutSplitWidth"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$layout$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["structureSidebarSplit"].read);
}
_s(useStructureSidebarWidth, "AiEUkOtGXpDdyjBGXzKhPoCvVoI=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$layout$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLayoutSplitWidth"]
    ];
});
function usePipelineCanvasWidth() {
    _s1();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$layout$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLayoutSplitWidth"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$layout$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pipelineCanvasSplit"].read);
}
_s1(usePipelineCanvasWidth, "AiEUkOtGXpDdyjBGXzKhPoCvVoI=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$layout$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLayoutSplitWidth"]
    ];
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/pipeline-builder.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PipelineBuilder",
    ()=>PipelineBuilder
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// AI : TODO refactor — only extract shared pipeline chrome if a third layout consumer appears (Logging already uses PipelineCanvas).
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/plus.mjs [app-client] (ecmascript) <export default as Plus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trash-2.mjs [app-client] (ecmascript) <export default as Trash2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$up$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowUp$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-up.mjs [app-client] (ecmascript) <export default as ArrowUp>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$down$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowDown$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-down.mjs [app-client] (ecmascript) <export default as ArrowDown>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/triangle-alert.mjs [app-client] (ecmascript) <export default as AlertTriangle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$copy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Copy$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/copy.mjs [app-client] (ecmascript) <export default as Copy>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/check.mjs [app-client] (ecmascript) <export default as Check>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/lock.mjs [app-client] (ecmascript) <export default as Lock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/zap.mjs [app-client] (ecmascript) <export default as Zap>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/store.tsx [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pipeline$2d$validity$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/pipeline-validity-ui.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$validity$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/structure-validity-ui.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$workspace$2d$validity$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/workspace-validity-ui.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$validity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/validity.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/validity.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$inspect$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/validity-inspect.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/validity-types.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$logging$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/logging-settings.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$use$2d$browser$2d$pref$2d$event$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/use-browser-pref-event.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$quote$2d$steps$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/quote-steps.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/validity-sync.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$parse$2d$steps$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/structure-parse-steps.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$billing$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/billing.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$billing$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/billing.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pipeline$2d$layout$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/pipeline-layout.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/module-ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pipeline$2d$module$2d$factory$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/pipeline-module-factory.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$window$2d$header$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/window-header.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$canvas$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/pipeline-canvas.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$summary$2d$box$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/pipeline-summary-box.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$module$2d$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/components/pipeline-module-fields.tsx [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/badge.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/format.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$run$2d$metrics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/run-metrics.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ui$2d$classes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/ui-classes.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/dropdown-menu.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/tooltip.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$kinds$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/module-kinds.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ui$2d$timing$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/ui-timing.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$clipboard$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/clipboard.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$shared$2f$clipboard$2f$copy$2d$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/shared/clipboard/copy-text.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$export$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/pipeline-export-dialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$resizable$2d$split$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/resizable-split.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$editor$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/editor-split-settings.ts [app-client] (ecmascript) <locals>");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
function PipelineBuilder() {
    _s();
    const { modules, setModules, models, model: globalModel, runs, typeAliases, project } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useStore"])();
    const [selectedId, setSelectedId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(modules[0]?.id ?? "");
    const [copied, setCopied] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$use$2d$browser$2d$pref$2d$event$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRerenderOnEvent"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$logging$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LOGGING_SETTINGS_CHANGED_EVENT"]);
    const savedCanvasWidth = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$editor$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["usePipelineCanvasWidth"])();
    const [canvasWidth, setCanvasWidth] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$editor$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["readPipelineCanvasWidth"]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PipelineBuilder.useEffect": ()=>setCanvasWidth(savedCanvasWidth)
    }["PipelineBuilder.useEffect"], [
        savedCanvasWidth
    ]);
    const selected = modules.find((m)=>m.id === selectedId);
    const { pipelineEditingBlocked: editingBlocked } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$workspace$2d$validity$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["computeWorkspaceValidity"])(modules, models, typeAliases);
    const typeIssueMessages = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$validity$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["structureIssueMessagesForUi"])(models, typeAliases);
    const invalid = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pipeline$2d$validity$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["computeInvalidForUi"])(modules, models, typeAliases);
    const warnings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["computeWarnings"])(modules, models);
    const warningCount = [
        ...warnings.values()
    ].reduce((n, ws)=>n + ws.length, 0);
    const metrics = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$billing$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["moduleMetrics"])(runs);
    const okRuns = runs.filter((r)=>r.status === "ok");
    const totalMs = okRuns.length > 0 ? okRuns.reduce((a, r)=>a + (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$run$2d$metrics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["runTotalMs"])(r), 0) / okRuns.length : null;
    const totalCost = okRuns.length > 0 ? okRuns.reduce((a, r)=>a + (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$run$2d$metrics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["runBilledCents"])(r), 0) / okRuns.length : null;
    const cachedCount = modules.filter((m)=>m.cached).length;
    function insertModule(kind, at = modules.length) {
        const fresh = kind === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ModuleKind"].Combine ? [
            {
                ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pipeline$2d$module$2d$factory$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["makeModule"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ModuleKind"].Input, models, globalModel),
                label: "Document Input"
            },
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pipeline$2d$module$2d$factory$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["makeModule"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ModuleKind"].Combine, models, globalModel)
        ] : [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pipeline$2d$module$2d$factory$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["makeModule"])(kind, models, globalModel)
        ];
        const next = [
            ...modules.slice(0, at),
            ...fresh,
            ...modules.slice(at)
        ];
        setModules(next);
        setSelectedId(fresh[fresh.length - 1].id);
    }
    function update(id, patch) {
        let next = modules.map((m)=>{
            if (m.id !== id) return m;
            const updated = {
                ...m,
                ...patch
            };
            if (updated.kind === "output" && patch.inStructureId) {
                updated.outStructureId = patch.inStructureId;
            }
            return updated;
        });
        if (patch.outStructureId !== undefined) {
            const step = modules.find((x)=>x.id === id);
            if (step?.kind === "input") {
                next = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["patchInputTargetStructure"])(next, id, patch.outStructureId);
            }
        }
        setModules(next);
    }
    function fixIoMismatch(moduleId, kind) {
        const issue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["invalidForModule"])(invalid, moduleId);
        if (!issue || issue.kind !== "io-mismatch" && issue.kind !== "cardinality-mismatch") return;
        if (kind === "adopt-upstream" && issue.upstreamEmits) {
            const m = modules.find((x)=>x.id === moduleId);
            const patch = {
                inStructureId: issue.upstreamEmits
            };
            if (m?.kind === "output") patch.outStructureId = issue.upstreamEmits;
            update(moduleId, patch);
            return;
        }
        if (kind === "align-upstream" && issue.expects) {
            const prevId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["prevModuleId"])(modules, moduleId);
            if (prevId) update(prevId, {
                outStructureId: issue.expects
            });
        }
    }
    function remove(id) {
        const m = modules.find((x)=>x.id === id);
        if (m && ((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isAutoQuoteStep"])(m) || (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isAutoStructureParseStep"])(m))) return;
        const drop = new Set((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pipeline$2d$layout$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["managedPipelinePairIds"])(modules, id));
        const next = modules.filter((m)=>!drop.has(m.id));
        setModules(next);
        if (drop.has(selectedId)) setSelectedId(next[0]?.id ?? "");
    }
    function move(id, dir) {
        const m = modules.find((x)=>x.id === id);
        if (m && ((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isAutoQuoteStep"])(m) || (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isAutoStructureParseStep"])(m))) return;
        const ids = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pipeline$2d$layout$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["managedPipelinePairIds"])(modules, id);
        const block = ids.map((x)=>modules.find((m)=>m.id === x));
        const rest = modules.filter((m)=>!ids.includes(m.id));
        const at = modules.findIndex((m)=>m.id === ids[0]);
        const insertAt = dir === -1 ? at - 1 : at + ids.length;
        if (insertAt < 0 || insertAt > rest.length) return;
        const next = [
            ...rest.slice(0, insertAt),
            ...block,
            ...rest.slice(insertAt)
        ];
        setModules(next);
    }
    async function copyPipelineJson() {
        const json = JSON.stringify({
            models,
            modules
        }, null, 2);
        const validationErrors = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatInvalidMapErrors"])(invalid, modules, models);
        const errorsBlock = validationErrors.trim() ? `\n\nCurrent pipeline validation errors:\n${validationErrors}\n` : "\n\nCurrent pipeline: valid (no I/O errors).\n";
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$shared$2f$clipboard$2f$copy$2d$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["copyTextToClipboard"])(`${json}${errorsBlock}`);
        setCopied(true);
        setTimeout(()=>setCopied(false), __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ui$2d$timing$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["COPY_FEEDBACK_MS"]);
    }
    const invalidMap = invalid;
    const warningMap = warnings;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TooltipProvider"], {
        delay: 200,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex h-full flex-col",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$window$2d$header$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WindowHeader"], {
                    step: "02 / Pipeline",
                    title: "Linear Pipeline",
                    description: "Each step declares its input and output model. Mismatched I/O is flagged — there is no explicit validation step.",
                    actions: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-3 font-mono text-[11px]",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                variant: "outline",
                                size: "sm",
                                className: "h-7 gap-1.5 text-[10px]",
                                onClick: ()=>void copyPipelineJson(),
                                children: [
                                    copied ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                                        className: "h-3 w-3"
                                    }, void 0, false, {
                                        fileName: "[project]/components/pipeline-builder.tsx",
                                        lineNumber: 192,
                                        columnNumber: 27
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$copy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Copy$3e$__["Copy"], {
                                        className: "h-3 w-3"
                                    }, void 0, false, {
                                        fileName: "[project]/components/pipeline-builder.tsx",
                                        lineNumber: 192,
                                        columnNumber: 59
                                    }, this),
                                    copied ? "Copied" : "Copy prompt"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/pipeline-builder.tsx",
                                lineNumber: 186,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$export$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineExportDialog"], {
                                project: project,
                                modules: modules,
                                models: models,
                                typeAliases: typeAliases
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-builder.tsx",
                                lineNumber: 195,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-muted-foreground",
                                children: totalMs != null ? `~${(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatSecondsShort"])(totalMs)} avg` : "— avg"
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-builder.tsx",
                                lineNumber: 196,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-muted-foreground",
                                children: totalCost != null ? `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCostCents"])(totalCost)}/run` : "—/run"
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-builder.tsx",
                                lineNumber: 199,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                variant: "outline",
                                className: "gap-1 text-[10px]",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__["Zap"], {
                                        className: "h-3 w-3 text-primary"
                                    }, void 0, false, {
                                        fileName: "[project]/components/pipeline-builder.tsx",
                                        lineNumber: 203,
                                        columnNumber: 17
                                    }, this),
                                    " ",
                                    cachedCount,
                                    " cached"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/pipeline-builder.tsx",
                                lineNumber: 202,
                                columnNumber: 15
                            }, this),
                            invalid.size > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                variant: "outline",
                                className: "gap-1 border-destructive/50 text-[10px] text-destructive",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__["AlertTriangle"], {
                                        className: "h-3 w-3"
                                    }, void 0, false, {
                                        fileName: "[project]/components/pipeline-builder.tsx",
                                        lineNumber: 207,
                                        columnNumber: 19
                                    }, this),
                                    " ",
                                    invalid.size,
                                    " invalid"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/pipeline-builder.tsx",
                                lineNumber: 206,
                                columnNumber: 17
                            }, this),
                            warningCount > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                variant: "outline",
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("gap-1 border-amber-500/50 text-[10px]", __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ui$2d$classes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WARNING_TEXT_CLASS"]),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__["AlertTriangle"], {
                                        className: "h-3 w-3"
                                    }, void 0, false, {
                                        fileName: "[project]/components/pipeline-builder.tsx",
                                        lineNumber: 212,
                                        columnNumber: 19
                                    }, this),
                                    " ",
                                    warningCount,
                                    " warning",
                                    warningCount === 1 ? "" : "s"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/pipeline-builder.tsx",
                                lineNumber: 211,
                                columnNumber: 17
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/pipeline-builder.tsx",
                        lineNumber: 185,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-builder.tsx",
                    lineNumber: 180,
                    columnNumber: 9
                }, this),
                editingBlocked && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "border-b border-destructive/30 bg-destructive/10 px-4 py-2.5",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "flex items-center gap-1.5 font-mono text-[11px] text-destructive",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__["AlertTriangle"], {
                                    className: "h-3.5 w-3.5 shrink-0"
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-builder.tsx",
                                    lineNumber: 222,
                                    columnNumber: 15
                                }, this),
                                "Fix type errors in Structure before editing the pipeline."
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/pipeline-builder.tsx",
                            lineNumber: 221,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                            className: "mt-1.5 space-y-0.5 pl-5 font-mono text-[10px] text-destructive/90",
                            children: [
                                typeIssueMessages.slice(0, 5).map((msg)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                        className: "list-disc",
                                        children: msg
                                    }, msg, false, {
                                        fileName: "[project]/components/pipeline-builder.tsx",
                                        lineNumber: 227,
                                        columnNumber: 17
                                    }, this)),
                                typeIssueMessages.length > 5 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                    className: "list-none text-destructive/70",
                                    children: [
                                        "+",
                                        typeIssueMessages.length - 5,
                                        " more…"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/pipeline-builder.tsx",
                                    lineNumber: 232,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/pipeline-builder.tsx",
                            lineNumber: 225,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/pipeline-builder.tsx",
                    lineNumber: 220,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$resizable$2d$split$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ResizableSplit"], {
                    className: "min-h-0 flex-1",
                    leadingWidth: canvasWidth,
                    onLeadingWidthChange: setCanvasWidth,
                    onLeadingWidthCommit: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$editor$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["writePipelineCanvasWidth"],
                    minLeading: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$editor$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["PIPELINE_CANVAS_MIN"],
                    maxLeading: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$editor$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["PIPELINE_CANVAS_MAX"],
                    leading: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "min-h-0 min-w-0 overflow-auto",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mx-auto flex min-h-full w-full max-w-4xl flex-col items-stretch px-6 py-8",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$canvas$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineCanvas"], {
                                modules: modules,
                                models: models,
                                selectedId: selectedId,
                                onSelect: setSelectedId,
                                invalid: invalidMap,
                                warnings: warningMap,
                                renderInsertBefore: (insertAt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(InsertSlot, {
                                        insertAt: insertAt,
                                        onInsert: insertModule,
                                        blocked: editingBlocked
                                    }, void 0, false, {
                                        fileName: "[project]/components/pipeline-builder.tsx",
                                        lineNumber: 258,
                                        columnNumber: 21
                                    }, this),
                                renderInsertAfter: (insertAt, opts)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(InsertSlot, {
                                        insertAt: insertAt,
                                        onInsert: insertModule,
                                        connectionInvalid: opts.connectionInvalid,
                                        blocked: editingBlocked || opts.blocked
                                    }, void 0, false, {
                                        fileName: "[project]/components/pipeline-builder.tsx",
                                        lineNumber: 261,
                                        columnNumber: 21
                                    }, this),
                                renderFooter: ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mt-6 flex w-full flex-col items-center",
                                        children: [
                                            !editingBlocked && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AddStepMenu, {
                                                insertAt: modules.length,
                                                onInsert: insertModule,
                                                variant: "button"
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-builder.tsx",
                                                lineNumber: 271,
                                                columnNumber: 25
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$summary$2d$box$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PipelineSummaryBox"], {}, void 0, false, {
                                                fileName: "[project]/components/pipeline-builder.tsx",
                                                lineNumber: 273,
                                                columnNumber: 23
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/pipeline-builder.tsx",
                                        lineNumber: 269,
                                        columnNumber: 21
                                    }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-builder.tsx",
                                lineNumber: 250,
                                columnNumber: 17
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/components/pipeline-builder.tsx",
                            lineNumber: 249,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-builder.tsx",
                        lineNumber: 248,
                        columnNumber: 13
                    }, this),
                    trailing: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
                        className: "flex min-h-0 flex-col overflow-hidden",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "border-b border-border px-3 py-2",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "font-mono text-[10px] uppercase tracking-wider text-muted-foreground",
                                    children: "Inspector"
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-builder.tsx",
                                    lineNumber: 283,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-builder.tsx",
                                lineNumber: 282,
                                columnNumber: 15
                            }, this),
                            selected ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mb-3 flex items-center justify-between",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "font-mono text-[10px] uppercase tracking-wider text-muted-foreground",
                                                children: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["MODULE_META"][selected.kind].label
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-builder.tsx",
                                                lineNumber: 291,
                                                columnNumber: 21
                                            }, this),
                                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isAutoQuoteStep"])(selected) ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AutoQuoteLockTooltip, {}, void 0, false, {
                                                fileName: "[project]/components/pipeline-builder.tsx",
                                                lineNumber: 295,
                                                columnNumber: 23
                                            }, this) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isAutoStructureParseStep"])(selected) ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AutoStructureParseLockTooltip, {}, void 0, false, {
                                                fileName: "[project]/components/pipeline-builder.tsx",
                                                lineNumber: 297,
                                                columnNumber: 23
                                            }, this) : editingBlocked ? null : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center gap-1",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                        size: "icon",
                                                        variant: "ghost",
                                                        className: "h-7 w-7",
                                                        onClick: ()=>move(selected.id, -1),
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$up$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowUp$3e$__["ArrowUp"], {
                                                            className: "h-3.5 w-3.5"
                                                        }, void 0, false, {
                                                            fileName: "[project]/components/pipeline-builder.tsx",
                                                            lineNumber: 301,
                                                            columnNumber: 27
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/pipeline-builder.tsx",
                                                        lineNumber: 300,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                        size: "icon",
                                                        variant: "ghost",
                                                        className: "h-7 w-7",
                                                        onClick: ()=>move(selected.id, 1),
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$down$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowDown$3e$__["ArrowDown"], {
                                                            className: "h-3.5 w-3.5"
                                                        }, void 0, false, {
                                                            fileName: "[project]/components/pipeline-builder.tsx",
                                                            lineNumber: 304,
                                                            columnNumber: 27
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/pipeline-builder.tsx",
                                                        lineNumber: 303,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                        size: "icon",
                                                        variant: "ghost",
                                                        className: "h-7 w-7 text-muted-foreground hover:text-destructive",
                                                        onClick: ()=>remove(selected.id),
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__["Trash2"], {
                                                            className: "h-3.5 w-3.5"
                                                        }, void 0, false, {
                                                            fileName: "[project]/components/pipeline-builder.tsx",
                                                            lineNumber: 312,
                                                            columnNumber: 27
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/pipeline-builder.tsx",
                                                        lineNumber: 306,
                                                        columnNumber: 25
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/pipeline-builder.tsx",
                                                lineNumber: 299,
                                                columnNumber: 23
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/pipeline-builder.tsx",
                                        lineNumber: 290,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$pipeline$2d$module$2d$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["PipelineModuleFields"], {
                                        module: selected,
                                        models: models,
                                        typeAliases: typeAliases,
                                        modules: modules,
                                        mode: editingBlocked ? "view" : "edit",
                                        globalModel: globalModel,
                                        invalid: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["invalidForModule"])(invalid, selected.id),
                                        invalidIssues: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["invalidIssuesForModule"])(invalid, selected.id),
                                        warnings: warnings.get(selected.id),
                                        ioMismatchFix: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$inspect$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ioMismatchInspectorFix"])(selected.id, modules, invalid, models),
                                        onUpdate: editingBlocked ? undefined : (patch)=>update(selected.id, patch),
                                        onFixIoMismatch: editingBlocked ? undefined : (mismatchModuleId, kind)=>fixIoMismatch(mismatchModuleId, kind)
                                    }, void 0, false, {
                                        fileName: "[project]/components/pipeline-builder.tsx",
                                        lineNumber: 317,
                                        columnNumber: 19
                                    }, this),
                                    !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isAutoQuoteStep"])(selected) && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isAutoStructureParseStep"])(selected) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mt-4 grid grid-cols-2 gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Stat, {
                                                label: "avg latency",
                                                value: metrics.has(selected.id) ? `${metrics.get(selected.id).avgMs}ms` : "—"
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-builder.tsx",
                                                lineNumber: 335,
                                                columnNumber: 23
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Stat, {
                                                label: "avg cost",
                                                value: metrics.has(selected.id) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatCostCents"])(metrics.get(selected.id).avgCostCents) : "—"
                                            }, void 0, false, {
                                                fileName: "[project]/components/pipeline-builder.tsx",
                                                lineNumber: 341,
                                                columnNumber: 23
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/pipeline-builder.tsx",
                                        lineNumber: 334,
                                        columnNumber: 21
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/pipeline-builder.tsx",
                                lineNumber: 289,
                                columnNumber: 17
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-1 items-center justify-center p-6 text-center",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs text-muted-foreground",
                                    children: "Add a module and select it to configure."
                                }, void 0, false, {
                                    fileName: "[project]/components/pipeline-builder.tsx",
                                    lineNumber: 354,
                                    columnNumber: 19
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/pipeline-builder.tsx",
                                lineNumber: 353,
                                columnNumber: 17
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/pipeline-builder.tsx",
                        lineNumber: 281,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/pipeline-builder.tsx",
                    lineNumber: 240,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/pipeline-builder.tsx",
            lineNumber: 179,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/pipeline-builder.tsx",
        lineNumber: 178,
        columnNumber: 5
    }, this);
}
_s(PipelineBuilder, "iWjbAk54CiuU5mOtK4K/rvpVmoc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$use$2d$browser$2d$pref$2d$event$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRerenderOnEvent"],
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$editor$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["usePipelineCanvasWidth"]
    ];
});
_c = PipelineBuilder;
function AutoQuoteLockTooltip() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tooltip"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TooltipTrigger"], {
                render: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {}, void 0, false, {
                    fileName: "[project]/components/pipeline-builder.tsx",
                    lineNumber: 371,
                    columnNumber: 17
                }, this),
                className: "inline-flex shrink-0 items-center gap-1 rounded-md border border-chart-2/40 bg-chart-2/10 px-1.5 py-0.5 text-chart-2",
                onClick: (e)=>e.stopPropagation(),
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__["Lock"], {
                        className: "h-3 w-3"
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-builder.tsx",
                        lineNumber: 375,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "font-mono text-[9px]",
                        children: "auto"
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-builder.tsx",
                        lineNumber: 376,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/pipeline-builder.tsx",
                lineNumber: 370,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TooltipContent"], {
                side: "left",
                className: "max-w-xs text-left leading-relaxed",
                children: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AUTO_QUOTE_EXPLAINER"]
            }, void 0, false, {
                fileName: "[project]/components/pipeline-builder.tsx",
                lineNumber: 378,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/pipeline-builder.tsx",
        lineNumber: 369,
        columnNumber: 5
    }, this);
}
_c1 = AutoQuoteLockTooltip;
function AutoStructureParseLockTooltip() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tooltip"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TooltipTrigger"], {
                render: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {}, void 0, false, {
                    fileName: "[project]/components/pipeline-builder.tsx",
                    lineNumber: 389,
                    columnNumber: 17
                }, this),
                className: "inline-flex shrink-0 items-center gap-1 rounded-md border border-chart-3/40 bg-chart-3/10 px-1.5 py-0.5 text-chart-3",
                onClick: (e)=>e.stopPropagation(),
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__["Lock"], {
                        className: "h-3 w-3"
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-builder.tsx",
                        lineNumber: 393,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "font-mono text-[9px]",
                        children: "auto"
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-builder.tsx",
                        lineNumber: 394,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/pipeline-builder.tsx",
                lineNumber: 388,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TooltipContent"], {
                side: "left",
                className: "max-w-xs text-left leading-relaxed",
                children: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$validity$2d$sync$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AUTO_STRUCTURE_PARSE_EXPLAINER"]
            }, void 0, false, {
                fileName: "[project]/components/pipeline-builder.tsx",
                lineNumber: 396,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/pipeline-builder.tsx",
        lineNumber: 387,
        columnNumber: 5
    }, this);
}
_c2 = AutoStructureParseLockTooltip;
function InsertSlot({ insertAt, onInsert, connectionInvalid, alwaysShow, blocked }) {
    if (blocked) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "h-4 w-px bg-border/60",
            "aria-hidden": true
        }, void 0, false, {
            fileName: "[project]/components/pipeline-builder.tsx",
            lineNumber: 417,
            columnNumber: 12
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "group relative flex h-8 w-full items-center justify-center",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("absolute h-full w-px transition-colors", connectionInvalid ? "bg-destructive" : "bg-border group-hover:bg-muted-foreground/40")
            }, void 0, false, {
                fileName: "[project]/components/pipeline-builder.tsx",
                lineNumber: 421,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AddStepMenu, {
                insertAt: insertAt,
                onInsert: onInsert,
                variant: "slot",
                alwaysShow: alwaysShow
            }, void 0, false, {
                fileName: "[project]/components/pipeline-builder.tsx",
                lineNumber: 427,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/pipeline-builder.tsx",
        lineNumber: 420,
        columnNumber: 5
    }, this);
}
_c3 = InsertSlot;
function AddStepMenu({ insertAt, onInsert, variant, alwaysShow }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenu"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuTrigger"], {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(variant === "slot" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("relative z-10 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-all hover:border-primary hover:bg-primary/10 hover:text-primary", alwaysShow ? "opacity-100" : "opacity-30 group-hover:opacity-100 data-popup-open:opacity-100") : "inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-border bg-transparent px-3 text-xs text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-foreground"),
                "aria-label": "Add pipeline step",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                        className: variant === "slot" ? "h-3 w-3" : "h-3.5 w-3.5"
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-builder.tsx",
                        lineNumber: 458,
                        columnNumber: 9
                    }, this),
                    variant === "button" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: "Add step"
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-builder.tsx",
                        lineNumber: 459,
                        columnNumber: 34
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/pipeline-builder.tsx",
                lineNumber: 445,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuContent"], {
                align: "center",
                className: "min-w-52",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuGroup"], {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuLabel"], {
                            className: "font-mono text-[10px] text-muted-foreground",
                            children: "Insert step"
                        }, void 0, false, {
                            fileName: "[project]/components/pipeline-builder.tsx",
                            lineNumber: 463,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-builder.tsx",
                        lineNumber: 462,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuGroup"], {
                        children: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$kinds$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["USER_ADDABLE_MODULE_KINDS"].map((k)=>{
                            const Icon = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["KIND_ICON"][k];
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuItem"], {
                                onClick: ()=>onInsert(k, insertAt),
                                className: "gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Icon, {
                                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("h-3.5 w-3.5", __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$module$2d$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["KIND_COLOR"][k])
                                    }, void 0, false, {
                                        fileName: "[project]/components/pipeline-builder.tsx",
                                        lineNumber: 472,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["MODULE_META"][k].label
                                    }, void 0, false, {
                                        fileName: "[project]/components/pipeline-builder.tsx",
                                        lineNumber: 473,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, k, true, {
                                fileName: "[project]/components/pipeline-builder.tsx",
                                lineNumber: 471,
                                columnNumber: 15
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/components/pipeline-builder.tsx",
                        lineNumber: 467,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/pipeline-builder.tsx",
                lineNumber: 461,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/pipeline-builder.tsx",
        lineNumber: 444,
        columnNumber: 5
    }, this);
}
_c4 = AddStepMenu;
function Stat({ label, value }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "rounded-md border border-border px-3 py-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "font-mono text-[10px] text-muted-foreground",
                children: label
            }, void 0, false, {
                fileName: "[project]/components/pipeline-builder.tsx",
                lineNumber: 486,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "font-mono text-sm",
                children: value
            }, void 0, false, {
                fileName: "[project]/components/pipeline-builder.tsx",
                lineNumber: 487,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/pipeline-builder.tsx",
        lineNumber: 485,
        columnNumber: 5
    }, this);
}
_c5 = Stat;
var _c, _c1, _c2, _c3, _c4, _c5;
__turbopack_context__.k.register(_c, "PipelineBuilder");
__turbopack_context__.k.register(_c1, "AutoQuoteLockTooltip");
__turbopack_context__.k.register(_c2, "AutoStructureParseLockTooltip");
__turbopack_context__.k.register(_c3, "InsertSlot");
__turbopack_context__.k.register(_c4, "AddStepMenu");
__turbopack_context__.k.register(_c5, "Stat");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/pipeline-builder.tsx [app-client] (ecmascript, next/dynamic entry)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/components/pipeline-builder.tsx [app-client] (ecmascript)"));
}),
]);

//# sourceMappingURL=_0mwpm2u._.js.map