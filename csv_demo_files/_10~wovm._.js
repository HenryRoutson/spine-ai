(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
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
"[project]/components/structure-field-ref-picker.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "StructureFieldRefPicker",
    ()=>StructureFieldRefPicker,
    "isRefFieldType",
    ()=>isRefFieldType
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$link$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Link2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/link-2.mjs [app-client] (ecmascript) <export default as Link2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/select.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$shell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/app-shell.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$ref$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/structure-ref.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/types.ts [app-client] (ecmascript) <locals>");
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
const REF_TYPES = [
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Model,
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].ListModel
];
function isRefFieldType(type) {
    return REF_TYPES.includes(type);
}
function StructureFieldRefPicker({ field, fields, models, selectedId, locked, onRefChange, className, compact }) {
    _s();
    const { openStructure } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$shell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAppShell"])();
    if (!isRefFieldType(field.type)) return null;
    const groups = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$ref$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["groupModelsForRefPicker"])(models, selectedId, fields);
    const refLabel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$ref$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["modelRefLabel"])(models, field.ref, fields.filter((f)=>f.ref === field.ref).map((f)=>f.name));
    const hasOptions = groups.roots.length + groups.nested.length + (groups.self ? 1 : 0) + groups.missing.length > 0;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex min-w-0 items-center gap-2", className),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("shrink-0 font-mono text-muted-foreground", compact ? "text-[9px]" : "text-[10px]"),
                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$ref$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["refPickerLabel"])(field.type)
            }, void 0, false, {
                fileName: "[project]/components/structure-field-ref-picker.tsx",
                lineNumber: 62,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                value: field.ref ?? "",
                onValueChange: (v)=>onRefChange(v ? v : undefined),
                disabled: locked || !hasOptions,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectTrigger"], {
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("min-w-0 flex-1 font-mono", compact ? "h-6 w-full text-[10px]" : "h-7 w-full text-[11px]"),
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "truncate",
                            children: refLabel
                        }, void 0, false, {
                            fileName: "[project]/components/structure-field-ref-picker.tsx",
                            lineNumber: 81,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/structure-field-ref-picker.tsx",
                        lineNumber: 75,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectContent"], {
                        className: "min-w-[12rem]",
                        children: [
                            groups.roots.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectGroup"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectLabel"], {
                                        className: "font-mono text-[10px] uppercase tracking-wider",
                                        children: "Root models"
                                    }, void 0, false, {
                                        fileName: "[project]/components/structure-field-ref-picker.tsx",
                                        lineNumber: 86,
                                        columnNumber: 15
                                    }, this),
                                    groups.roots.map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                            value: m.id,
                                            className: "font-mono text-xs",
                                            children: m.name
                                        }, m.id, false, {
                                            fileName: "[project]/components/structure-field-ref-picker.tsx",
                                            lineNumber: 90,
                                            columnNumber: 17
                                        }, this))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/structure-field-ref-picker.tsx",
                                lineNumber: 85,
                                columnNumber: 13
                            }, this),
                            groups.nested.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectGroup"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectLabel"], {
                                        className: "font-mono text-[10px] uppercase tracking-wider",
                                        children: "Sub-types"
                                    }, void 0, false, {
                                        fileName: "[project]/components/structure-field-ref-picker.tsx",
                                        lineNumber: 98,
                                        columnNumber: 15
                                    }, this),
                                    groups.nested.map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                            value: m.id,
                                            className: "font-mono text-xs",
                                            children: m.name
                                        }, m.id, false, {
                                            fileName: "[project]/components/structure-field-ref-picker.tsx",
                                            lineNumber: 102,
                                            columnNumber: 17
                                        }, this))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/structure-field-ref-picker.tsx",
                                lineNumber: 97,
                                columnNumber: 13
                            }, this),
                            groups.self && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectGroup"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectLabel"], {
                                        className: "font-mono text-[10px] uppercase tracking-wider",
                                        children: "This model"
                                    }, void 0, false, {
                                        fileName: "[project]/components/structure-field-ref-picker.tsx",
                                        lineNumber: 110,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                        value: groups.self.id,
                                        className: "font-mono text-xs",
                                        children: [
                                            groups.self.name,
                                            " (recursive)"
                                        ]
                                    }, groups.self.id, true, {
                                        fileName: "[project]/components/structure-field-ref-picker.tsx",
                                        lineNumber: 113,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/structure-field-ref-picker.tsx",
                                lineNumber: 109,
                                columnNumber: 13
                            }, this),
                            groups.missing.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectGroup"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectLabel"], {
                                        className: "font-mono text-[10px] uppercase tracking-wider",
                                        children: "Missing"
                                    }, void 0, false, {
                                        fileName: "[project]/components/structure-field-ref-picker.tsx",
                                        lineNumber: 120,
                                        columnNumber: 15
                                    }, this),
                                    groups.missing.map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                            value: m.id,
                                            className: "font-mono text-xs",
                                            children: m.name
                                        }, m.id, false, {
                                            fileName: "[project]/components/structure-field-ref-picker.tsx",
                                            lineNumber: 124,
                                            columnNumber: 17
                                        }, this))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/structure-field-ref-picker.tsx",
                                lineNumber: 119,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/structure-field-ref-picker.tsx",
                        lineNumber: 83,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/structure-field-ref-picker.tsx",
                lineNumber: 70,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "button",
                size: "icon",
                variant: "ghost",
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("shrink-0 text-muted-foreground", compact ? "h-6 w-6" : "h-7 w-7"),
                disabled: !field.ref || locked,
                onClick: ()=>field.ref && openStructure(field.ref),
                title: field.ref ? `Open ${refLabel} in Structure tab` : "Pick a model to open",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$link$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Link2$3e$__["Link2"], {
                    className: compact ? "h-3 w-3" : "h-3.5 w-3.5"
                }, void 0, false, {
                    fileName: "[project]/components/structure-field-ref-picker.tsx",
                    lineNumber: 141,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/structure-field-ref-picker.tsx",
                lineNumber: 132,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/structure-field-ref-picker.tsx",
        lineNumber: 61,
        columnNumber: 5
    }, this);
}
_s(StructureFieldRefPicker, "4+3yijfSaAAOgtcPy3XMbGfstx8=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$shell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAppShell"]
    ];
});
_c = StructureFieldRefPicker;
var _c;
__turbopack_context__.k.register(_c, "StructureFieldRefPicker");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/structure-field-labels.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FIELD_TYPE_LABELS",
    ()=>FIELD_TYPE_LABELS,
    "FIELD_TYPE_OPTIONS",
    ()=>FIELD_TYPE_OPTIONS,
    "fieldTypeFromLabel",
    ()=>fieldTypeFromLabel,
    "fieldTypeLabel",
    ()=>fieldTypeLabel
]);
const FIELD_TYPE_LABELS = {
    text: "Text",
    int: "Whole number",
    float: "Decimal number",
    bool: "Yes / No",
    datetime: "Date or time",
    document: "Document",
    "list[document]": "List of documents",
    json: "Flexible data",
    "list[text]": "List of text",
    "tuple[text,quote]": "Text with source quote",
    "list[tuple[text,quote]]": "List of quoted text",
    model: "Nested record",
    "list[model]": "List of records"
};
const FIELD_TYPE_OPTIONS = Object.entries(FIELD_TYPE_LABELS).map(_c = ([value, label])=>({
        value,
        label
    }));
_c1 = FIELD_TYPE_OPTIONS;
function fieldTypeLabel(type) {
    return FIELD_TYPE_LABELS[type] ?? type;
}
function fieldTypeFromLabel(label) {
    const match = FIELD_TYPE_OPTIONS.find((o)=>o.label === label);
    return match?.value;
}
var _c, _c1;
__turbopack_context__.k.register(_c, "FIELD_TYPE_OPTIONS$(Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]).map");
__turbopack_context__.k.register(_c1, "FIELD_TYPE_OPTIONS");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/type-expr-parse.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "fieldTypeExprSource",
    ()=>fieldTypeExprSource,
    "formatTypeExprPy",
    ()=>formatTypeExprPy,
    "legacyFieldFromTypeExpr",
    ()=>legacyFieldFromTypeExpr,
    "parseTypeExprString",
    ()=>parseTypeExprString,
    "tryParseTypeExprString",
    ()=>tryParseTypeExprString
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/type_expr.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/builtin_models.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/types.ts [app-client] (ecmascript) <locals>");
;
;
;
const PRIM_ALIASES = {
    text: "text",
    str: "text",
    string: "text",
    int: "int",
    float: "float",
    bool: "bool",
    datetime: "datetime",
    json: "json"
};
// AI : split on a separator at bracket depth 0 — supports nested list[tuple[A, B]].
function splitTopLevel(source, sep) {
    const parts = [];
    let depth = 0;
    let start = 0;
    for(let i = 0; i < source.length; i++){
        const ch = source[i];
        if (ch === "[" || ch === "(") depth++;
        else if (ch === "]" || ch === ")") depth = Math.max(0, depth - 1);
        else if (depth === 0 && source.slice(i, i + sep.length) === sep) {
            parts.push(source.slice(start, i).trim());
            start = i + sep.length;
            i += sep.length - 1;
        }
    }
    parts.push(source.slice(start).trim());
    return parts.filter(Boolean);
}
function modelByName(models, name) {
    return models.find((m)=>m.name === name);
}
function parseIdentifier(raw, models) {
    const id = raw.trim();
    if (!id) throw new Error("Empty type name");
    const prim = PRIM_ALIASES[id.toLowerCase()];
    if (prim) return {
        kind: "prim",
        name: prim
    };
    if (id === "Document") return {
        kind: "document"
    };
    if (id === "quote_string_t") return {
        kind: "quote"
    };
    if (id.toLowerCase() === "quote") return {
        kind: "quote"
    };
    if (id === "Quote") return {
        kind: "quote"
    };
    if (id === "text_quote_t") return {
        kind: "text_quote"
    };
    if (id === "TextQuote") return {
        kind: "text_quote"
    };
    if (id === "quote_span_t" || id === "QuoteSpan") {
        return {
            kind: "ref",
            modelId: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BUILTIN_QUOTE_SPAN_ID"]
        };
    }
    if (id === "UNSET") return {
        kind: "unset"
    };
    const hit = modelByName(models, id);
    if (hit) return {
        kind: "ref",
        modelId: hit.id
    };
    return {
        kind: "named",
        name: id
    };
}
function parseGeneric(name, argsStr, models) {
    const args = splitTopLevel(argsStr, ",").map((part)=>parseTypeExprString(part, models));
    const lower = name.toLowerCase();
    if (lower === "list") {
        if (args.length !== 1) throw new Error("list[T] takes one type argument");
        return {
            kind: "list",
            item: args[0]
        };
    }
    if (lower === "set") {
        if (args.length !== 1) throw new Error("set[T] takes one type argument");
        return {
            kind: "set",
            item: args[0]
        };
    }
    if (lower === "optional") {
        if (args.length !== 1) throw new Error("Optional[T] takes one type argument");
        return {
            kind: "optional",
            inner: args[0]
        };
    }
    if (lower === "tuple") {
        if (args.length < 2) throw new Error("tuple needs at least two element types");
        return {
            kind: "generic",
            name: "tuple",
            args
        };
    }
    if (lower === "dict" || lower === "map") {
        if (args.length !== 2) throw new Error("dict[K, V] needs key and value types");
        return {
            kind: "map",
            key: args[0],
            value: args[1]
        };
    }
    if (lower === "union") {
        if (args.length < 2) throw new Error("Union needs at least two variants");
        return {
            kind: "union",
            variants: args
        };
    }
    const model = modelByName(models, name);
    if (model && args.length === 0) return {
        kind: "ref",
        modelId: model.id
    };
    return {
        kind: "generic",
        name,
        args
    };
}
function parsePrimary(source, models) {
    const s = source.trim();
    if (!s) throw new Error("Empty type expression");
    const optionalMatch = /^(Optional|optional)\[([\s\S]+)\]$/.exec(s);
    if (optionalMatch) {
        return {
            kind: "optional",
            inner: parseTypeExprString(optionalMatch[2].trim(), models)
        };
    }
    const unionMatch = /^Union\[([\s\S]+)\]$/.exec(s);
    if (unionMatch) {
        const variants = splitTopLevel(unionMatch[1], ",").map((part)=>parseTypeExprString(part, models));
        if (variants.length < 2) throw new Error("Union needs at least two variants");
        return {
            kind: "union",
            variants
        };
    }
    const bracket = s.indexOf("[");
    if (bracket > 0 && s.endsWith("]")) {
        const name = s.slice(0, bracket).trim();
        const argsStr = s.slice(bracket + 1, -1);
        return parseGeneric(name, argsStr, models);
    }
    return parseIdentifier(s, models);
}
function parseTypeExprString(source, models) {
    const trimmed = source.trim();
    if (!trimmed) throw new Error("Type expression required");
    if (trimmed.includes("|")) {
        const variants = splitTopLevel(trimmed, "|").map((part)=>parsePrimary(part, models));
        if (variants.length < 2) throw new Error("Union needs at least two variants");
        return {
            kind: "union",
            variants
        };
    }
    return parsePrimary(trimmed, models);
}
function tryParseTypeExprString(source, models) {
    try {
        return {
            ok: true,
            expr: parseTypeExprString(source, models)
        };
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : "Invalid type expression"
        };
    }
}
function formatTypeExprPy(expr, models = []) {
    switch(expr.kind){
        case "prim":
            return expr.name === "text" ? "str" : expr.name;
        case "document":
            return "Document";
        case "quote":
            return "quote_string_t";
        case "text_quote":
            return "text_quote_t";
        case "list":
            return `list[${formatTypeExprPy(expr.item, models)}]`;
        case "ref":
            {
                const name = models.find((m)=>m.id === expr.modelId)?.name;
                return name ?? String(expr.modelId);
            }
        case "optional":
            return `Optional[${formatTypeExprPy(expr.inner, models)}]`;
        case "set":
            return `set[${formatTypeExprPy(expr.item, models)}]`;
        case "map":
            return `dict[${formatTypeExprPy(expr.key, models)}, ${formatTypeExprPy(expr.value, models)}]`;
        case "union":
            return expr.variants.map((v)=>formatTypeExprPy(v, models)).join(" | ");
        case "generic":
            if (expr.name === "tuple") {
                return `tuple[${expr.args.map((a)=>formatTypeExprPy(a, models)).join(", ")}]`;
            }
            return expr.args.length ? `${expr.name}[${expr.args.map((a)=>formatTypeExprPy(a, models)).join(", ")}]` : expr.name;
        case "named":
            return expr.name;
        case "unset":
            return "UNSET";
        case "file":
            return "FileInput";
        case "unknown":
            return "Any";
        default:
            return "Any";
    }
}
function legacyFieldFromTypeExpr(expr) {
    switch(expr.kind){
        case "prim":
            if (expr.name === "json") return {
                type: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Json
            };
            if (expr.name === "text") return {
                type: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Text
            };
            if (expr.name === "int") return {
                type: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Int
            };
            if (expr.name === "float") return {
                type: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Float
            };
            if (expr.name === "bool") return {
                type: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Bool
            };
            if (expr.name === "datetime") return {
                type: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Datetime
            };
            return null;
        case "document":
            return {
                type: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Document
            };
        case "text_quote":
            return {
                type: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].TupleTextQuote
            };
        case "list":
            if (expr.item.kind === "text_quote") return {
                type: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].ListTupleTextQuote
            };
            if (expr.item.kind === "document") return {
                type: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].ListDocument
            };
            if (expr.item.kind === "prim" && expr.item.name === "text") return {
                type: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].ListText
            };
            if (expr.item.kind === "ref") return {
                type: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].ListModel,
                ref: expr.item.modelId
            };
            return null;
        case "ref":
            return {
                type: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Model,
                ref: expr.modelId
            };
        default:
            return null;
    }
}
function fieldTypeExprSource(field, models) {
    return formatTypeExprPy((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fieldToTypeExpr"])(field), models);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/structure-field-type-editor.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "StructureFieldTypeEditor",
    ()=>StructureFieldTypeEditor
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/select.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$field$2d$ref$2d$picker$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/structure-field-ref-picker.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$field$2d$labels$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/structure-field-labels.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$ref$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/structure-ref.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$parse$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/type-expr-parse.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/type_expr.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/store.tsx [app-client] (ecmascript) <locals>");
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
const REF_TYPES = [
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Model,
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].ListModel
];
const PRESET_TYPES = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FIELD_TYPES"].filter(_c = (t)=>!REF_TYPES.includes(t));
_c1 = PRESET_TYPES;
const ALIAS_PREFIX = "alias:";
function isRefField(field) {
    if (REF_TYPES.includes(field.type) && !field.typeExpr) return true;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["typeExprRefModelId"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fieldToTypeExpr"])(field)) !== undefined;
}
function refFieldType(field) {
    const expr = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fieldToTypeExpr"])(field);
    if (expr.kind === "list" && expr.item.kind === "ref") return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].ListModel;
    if (expr.kind === "optional" && expr.inner.kind === "list" && expr.inner.item.kind === "ref") {
        return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].ListModel;
    }
    if (expr.kind === "ref") return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Model;
    return field.type === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].ListModel ? __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].ListModel : __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Model;
}
function refFieldForPicker(field) {
    const refId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["typeExprRefModelId"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fieldToTypeExpr"])(field));
    if (!refId) return field;
    const asList = refFieldType(field) === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].ListModel;
    return {
        ...field,
        type: asList ? __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].ListModel : __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Model,
        ref: refId,
        typeExpr: undefined
    };
}
function resolveSelectValueWithAliases(field, models, typeAliases) {
    const expr = field.typeExpr;
    if (expr) {
        if (expr.kind === "named") {
            const alias = typeAliases.find((t)=>t.name === expr.name);
            if (alias) return {
                value: `${ALIAS_PREFIX}${alias.id}`
            };
            return {
                value: "__orphan__",
                orphanLabel: expr.name
            };
        }
        const legacy = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$parse$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["legacyFieldFromTypeExpr"])(expr);
        if (legacy?.type === "model" || legacy?.type === "list[model]") return {
            value: legacy.type
        };
        if (legacy && PRESET_TYPES.includes(legacy.type)) return {
            value: legacy.type
        };
        const matched = typeAliases.find((t)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["typeExprEqual"])(t.expr, expr));
        if (matched) return {
            value: `${ALIAS_PREFIX}${matched.id}`
        };
        return {
            value: "__orphan__",
            orphanLabel: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$parse$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatTypeExprPy"])(expr, models)
        };
    }
    if (field.type === "model" || field.type === "list[model]") return {
        value: field.type
    };
    if (PRESET_TYPES.includes(field.type)) return {
        value: field.type
    };
    return {
        value: field.type
    };
}
function resolveSelectDisplayLabel(selectValue, typeAliases, orphanLabel) {
    if (selectValue.startsWith(ALIAS_PREFIX)) {
        const alias = typeAliases.find((t)=>t.id === selectValue.slice(ALIAS_PREFIX.length));
        return alias?.name ?? selectValue;
    }
    if (selectValue === "__orphan__") {
        return orphanLabel ? `${orphanLabel} (pick a type)` : "Unknown type";
    }
    if (selectValue === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Model) return "Nested record…";
    if (selectValue === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].ListModel) return "List of records…";
    if (PRESET_TYPES.includes(selectValue)) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$field$2d$labels$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fieldTypeLabel"])(selectValue);
    return selectValue;
}
function StructureFieldTypeEditor({ field, fields, models, selectedId, locked, onUpdate }) {
    _s();
    const { typeAliases } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useStore"])();
    const { value: selectValue, orphanLabel } = resolveSelectValueWithAliases(field, models, typeAliases);
    const selectDisplayLabel = resolveSelectDisplayLabel(selectValue, typeAliases, orphanLabel);
    const showRefPicker = isRefField(field);
    function selectType(next) {
        if (!next || next === "__orphan__") return;
        if (next.startsWith(ALIAS_PREFIX)) {
            const aliasId = next.slice(ALIAS_PREFIX.length);
            const alias = typeAliases.find((t)=>t.id === aliasId);
            if (!alias) return;
            onUpdate({
                type: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Json,
                typeExpr: {
                    kind: "named",
                    name: alias.name
                },
                ref: undefined
            });
            return;
        }
        if (next === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Model || next === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].ListModel) {
            onUpdate({
                type: next,
                typeExpr: undefined,
                ref: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$ref$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pickDefaultModelRef"])(models, selectedId)
            });
            return;
        }
        onUpdate({
            type: next,
            typeExpr: undefined,
            ref: undefined
        });
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-w-0 space-y-1",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                value: selectValue,
                onValueChange: selectType,
                disabled: locked,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectTrigger"], {
                        className: "h-8 font-mono text-xs",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectValue"], {
                            placeholder: "Pick type…",
                            children: selectDisplayLabel
                        }, void 0, false, {
                            fileName: "[project]/components/structure-field-type-editor.tsx",
                            lineNumber: 146,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/structure-field-type-editor.tsx",
                        lineNumber: 145,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectContent"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectGroup"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectLabel"], {
                                        className: "font-mono text-[10px] uppercase tracking-wider",
                                        children: "Scalars"
                                    }, void 0, false, {
                                        fileName: "[project]/components/structure-field-type-editor.tsx",
                                        lineNumber: 150,
                                        columnNumber: 13
                                    }, this),
                                    PRESET_TYPES.map((t)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                            value: t,
                                            className: "font-mono text-xs",
                                            children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$field$2d$labels$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fieldTypeLabel"])(t)
                                        }, t, false, {
                                            fileName: "[project]/components/structure-field-type-editor.tsx",
                                            lineNumber: 154,
                                            columnNumber: 15
                                        }, this))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/structure-field-type-editor.tsx",
                                lineNumber: 149,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectGroup"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectLabel"], {
                                        className: "font-mono text-[10px] uppercase tracking-wider",
                                        children: "Structs"
                                    }, void 0, false, {
                                        fileName: "[project]/components/structure-field-type-editor.tsx",
                                        lineNumber: 160,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                        value: "model",
                                        className: "font-mono text-xs",
                                        children: "Nested record…"
                                    }, void 0, false, {
                                        fileName: "[project]/components/structure-field-type-editor.tsx",
                                        lineNumber: 163,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                        value: "list[model]",
                                        className: "font-mono text-xs",
                                        children: "List of records…"
                                    }, void 0, false, {
                                        fileName: "[project]/components/structure-field-type-editor.tsx",
                                        lineNumber: 166,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/structure-field-type-editor.tsx",
                                lineNumber: 159,
                                columnNumber: 11
                            }, this),
                            typeAliases.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectGroup"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectLabel"], {
                                        className: "font-mono text-[10px] uppercase tracking-wider",
                                        children: "Types"
                                    }, void 0, false, {
                                        fileName: "[project]/components/structure-field-type-editor.tsx",
                                        lineNumber: 172,
                                        columnNumber: 15
                                    }, this),
                                    typeAliases.map((t)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                            value: `${ALIAS_PREFIX}${t.id}`,
                                            className: "font-mono text-xs",
                                            children: t.name
                                        }, t.id, false, {
                                            fileName: "[project]/components/structure-field-type-editor.tsx",
                                            lineNumber: 176,
                                            columnNumber: 17
                                        }, this))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/structure-field-type-editor.tsx",
                                lineNumber: 171,
                                columnNumber: 13
                            }, this),
                            orphanLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectGroup"], {
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                    value: "__orphan__",
                                    disabled: true,
                                    className: "font-mono text-xs text-muted-foreground",
                                    children: [
                                        orphanLabel,
                                        " (pick a type)"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/structure-field-type-editor.tsx",
                                    lineNumber: 184,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/structure-field-type-editor.tsx",
                                lineNumber: 183,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/structure-field-type-editor.tsx",
                        lineNumber: 148,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/structure-field-type-editor.tsx",
                lineNumber: 144,
                columnNumber: 7
            }, this),
            showRefPicker && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$field$2d$ref$2d$picker$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureFieldRefPicker"], {
                field: refFieldForPicker(field),
                fields: fields,
                models: models,
                selectedId: selectedId,
                locked: locked,
                compact: true,
                onRefChange: (ref)=>onUpdate({
                        type: refFieldType(field),
                        ref,
                        typeExpr: undefined
                    })
            }, void 0, false, {
                fileName: "[project]/components/structure-field-type-editor.tsx",
                lineNumber: 193,
                columnNumber: 9
            }, this),
            typeAliases.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "font-mono text-[9px] text-muted-foreground",
                children: "Add reusable types in the sidebar → Types"
            }, void 0, false, {
                fileName: "[project]/components/structure-field-type-editor.tsx",
                lineNumber: 211,
                columnNumber: 9
            }, this),
            orphanLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("font-mono text-[9px] text-amber-700 dark:text-amber-500"),
                children: "Unknown type — recreate it under Types or pick another"
            }, void 0, false, {
                fileName: "[project]/components/structure-field-type-editor.tsx",
                lineNumber: 217,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/structure-field-type-editor.tsx",
        lineNumber: 143,
        columnNumber: 5
    }, this);
}
_s(StructureFieldTypeEditor, "MD9CuUIGeiRwdWwjIyiPNugFAAY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useStore"]
    ];
});
_c2 = StructureFieldTypeEditor;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "PRESET_TYPES$FIELD_TYPES.filter");
__turbopack_context__.k.register(_c1, "PRESET_TYPES");
__turbopack_context__.k.register(_c2, "StructureFieldTypeEditor");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/structure-field-row.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "StructureFieldRow",
    ()=>StructureFieldRow
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.mjs [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$field$2d$type$2d$editor$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/structure-field-type-editor.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
"use client";
;
;
;
;
;
;
function StructureFieldRow({ field, fields, models, selectedId, locked, onUpdate, onRemove }) {
    const isLegacyJson = field.type === "json" && !field.typeExpr;
    const isNumeric = field.type === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Int || field.type === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Float;
    const toleranceEnabled = isNumeric && field.deterministic !== false;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-[1.1fr_1fr_1.2fr_1fr_auto] items-start gap-2 border-b border-border px-3 py-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                        value: field.name,
                        onChange: (e)=>onUpdate({
                                name: e.target.value
                            }),
                        readOnly: locked,
                        className: "h-8 font-mono text-xs"
                    }, void 0, false, {
                        fileName: "[project]/components/structure-field-row.tsx",
                        lineNumber: 33,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$field$2d$type$2d$editor$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureFieldTypeEditor"], {
                        field: field,
                        fields: fields,
                        models: models,
                        selectedId: selectedId,
                        locked: locked,
                        onUpdate: onUpdate
                    }, void 0, false, {
                        fileName: "[project]/components/structure-field-row.tsx",
                        lineNumber: 39,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                        value: field.description,
                        placeholder: "—",
                        onChange: (e)=>onUpdate({
                                description: e.target.value
                            }),
                        readOnly: locked,
                        className: "h-8 text-xs"
                    }, void 0, false, {
                        fileName: "[project]/components/structure-field-row.tsx",
                        lineNumber: 47,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                        value: field.example ?? "",
                        placeholder: "e.g. Acme Ltd",
                        onChange: (e)=>onUpdate({
                                example: e.target.value || undefined
                            }),
                        readOnly: locked,
                        className: "h-8 font-mono text-xs"
                    }, void 0, false, {
                        fileName: "[project]/components/structure-field-row.tsx",
                        lineNumber: 54,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex h-8 items-center justify-center gap-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>onUpdate({
                                        optional: !field.optional
                                    }),
                                disabled: locked,
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("h-5 w-5 rounded border text-[10px] font-medium", field.optional ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"),
                                children: field.optional ? "?" : "·"
                            }, void 0, false, {
                                fileName: "[project]/components/structure-field-row.tsx",
                                lineNumber: 62,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>onUpdate({
                                        deterministic: field.deterministic === false ? undefined : false
                                    }),
                                disabled: locked,
                                title: field.deterministic === false ? "probabilistic — value varies between runs (LLM prose); tests ignore this field" : "deterministic — same input always gives this value (maths answer, id, enum); tests exact-compare it",
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("h-5 w-5 rounded border text-[10px] font-medium", field.deterministic === false ? "border-chart-3 bg-chart-3/15 text-chart-3" : "border-border text-muted-foreground"),
                                children: field.deterministic === false ? "≈" : "="
                            }, void 0, false, {
                                fileName: "[project]/components/structure-field-row.tsx",
                                lineNumber: 75,
                                columnNumber: 11
                            }, this),
                            toleranceEnabled ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                type: "number",
                                min: 0,
                                step: 1,
                                value: field.testTolerance ?? "",
                                placeholder: "±",
                                disabled: locked,
                                title: "test tolerance — ± on int/float compare (structure-level, not per test)",
                                onChange: (e)=>{
                                    const raw = e.target.value.trim();
                                    if (!raw) {
                                        onUpdate({
                                            testTolerance: undefined
                                        });
                                        return;
                                    }
                                    const n = Number(raw);
                                    onUpdate({
                                        testTolerance: Number.isFinite(n) && n >= 0 ? n : undefined
                                    });
                                },
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("h-5 w-9 rounded border bg-background px-0.5 text-center font-mono text-[10px]", field.testTolerance !== undefined ? "border-output/50 text-output" : "border-border text-muted-foreground")
                            }, void 0, false, {
                                fileName: "[project]/components/structure-field-row.tsx",
                                lineNumber: 93,
                                columnNumber: 13
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "h-5 w-9",
                                "aria-hidden": true
                            }, void 0, false, {
                                fileName: "[project]/components/structure-field-row.tsx",
                                lineNumber: 118,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: onRemove,
                                disabled: locked,
                                className: "text-muted-foreground hover:text-destructive disabled:opacity-40",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                    className: "h-3.5 w-3.5"
                                }, void 0, false, {
                                    fileName: "[project]/components/structure-field-row.tsx",
                                    lineNumber: 125,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/structure-field-row.tsx",
                                lineNumber: 120,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/structure-field-row.tsx",
                        lineNumber: 61,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/structure-field-row.tsx",
                lineNumber: 32,
                columnNumber: 7
            }, this),
            isLegacyJson && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "border-b border-border bg-amber-500/5 px-3 py-1.5",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("font-mono text-[10px] text-amber-700 dark:text-amber-500"),
                    children: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["JSON_FIELD_PREFER_STRUCTURE_MSG"]
                }, void 0, false, {
                    fileName: "[project]/components/structure-field-row.tsx",
                    lineNumber: 131,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/structure-field-row.tsx",
                lineNumber: 130,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/structure-field-row.tsx",
        lineNumber: 31,
        columnNumber: 5
    }, this);
}
_c = StructureFieldRow;
var _c;
__turbopack_context__.k.register(_c, "StructureFieldRow");
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
"[project]/components/structure-excel-editor.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "StructureExcelEditor",
    ()=>StructureExcelEditor
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/plus.mjs [app-client] (ecmascript) <export default as Plus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trash-2.mjs [app-client] (ecmascript) <export default as Trash2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/lock.mjs [app-client] (ecmascript) <export default as Lock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/triangle-alert.mjs [app-client] (ecmascript) <export default as AlertTriangle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/store.tsx [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$id$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/id.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/structure.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/builtin_models.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$field$2d$type$2d$editor$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/structure-field-type-editor.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$field$2d$labels$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/structure-field-labels.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ui$2d$classes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/ui-classes.ts [app-client] (ecmascript)");
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
function StructureExcelEditor({ selectedId, onSelectId }) {
    _s();
    const { models, setModels } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useStore"])();
    const selected = models.find((m)=>m.id === selectedId) ?? models[0];
    const selectedLocked = selected ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isLockedStructureModel"])(selected) : false;
    function updateModel(next) {
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isLockedStructureModel"])(next)) return;
        setModels(models.map((m)=>m.id === next.id ? next : m));
    }
    function deleteModel(id) {
        const target = models.find((m)=>m.id === id);
        if (target && (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isLockedStructureModel"])(target)) return;
        const next = models.filter((m)=>m.id !== id);
        setModels(next);
        if (selectedId === id) onSelectId(next[0]?.id ?? "");
    }
    function addField() {
        if (!selected) return;
        updateModel({
            ...selected,
            fields: [
                ...selected.fields,
                {
                    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$id$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uid"])(),
                    name: "field",
                    type: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Text,
                    optional: false,
                    description: ""
                }
            ]
        });
    }
    function updateField(fieldId, patch) {
        if (!selected) return;
        updateModel({
            ...selected,
            fields: selected.fields.map((f)=>f.id === fieldId ? {
                    ...f,
                    ...patch
                } : f)
        });
    }
    function removeField(fieldId) {
        if (!selected) return;
        updateModel({
            ...selected,
            fields: selected.fields.filter((f)=>f.id !== fieldId)
        });
    }
    if (!selected) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex flex-1 items-center justify-center",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xs text-muted-foreground",
                children: "No structure selected — add one in the sidebar."
            }, void 0, false, {
                fileName: "[project]/components/structure-excel-editor.tsx",
                lineNumber: 70,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/components/structure-excel-editor.tsx",
            lineNumber: 69,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex min-w-0 flex-1 flex-col overflow-hidden bg-[oklch(0.16_0.004_264)]",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "shrink-0 border-b border-border bg-secondary/30 px-4 py-3",
                children: [
                    selectedLocked && (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["lockedStructureBanner"])(selected) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mb-2 flex items-center gap-2 text-[11px] text-muted-foreground",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__["Lock"], {
                                className: "h-3.5 w-3.5"
                            }, void 0, false, {
                                fileName: "[project]/components/structure-excel-editor.tsx",
                                lineNumber: 81,
                                columnNumber: 13
                            }, this),
                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["lockedStructureBanner"])(selected)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/structure-excel-editor.tsx",
                        lineNumber: 80,
                        columnNumber: 11
                    }, this),
                    selected.fields.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("mb-2 flex items-center gap-2 text-[11px]", __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ui$2d$classes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WARNING_TEXT_CLASS"]),
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__["AlertTriangle"], {
                                className: "h-3.5 w-3.5 shrink-0"
                            }, void 0, false, {
                                fileName: "[project]/components/structure-excel-editor.tsx",
                                lineNumber: 87,
                                columnNumber: 13
                            }, this),
                            "Add at least one row before using this structure in a pipeline"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/structure-excel-editor.tsx",
                        lineNumber: 86,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-start gap-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "min-w-0 flex-1 space-y-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        value: selected.name,
                                        onChange: (e)=>updateModel({
                                                ...selected,
                                                name: e.target.value
                                            }),
                                        readOnly: selectedLocked,
                                        placeholder: "Structure name",
                                        className: "w-full border-0 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground read-only:cursor-default"
                                    }, void 0, false, {
                                        fileName: "[project]/components/structure-excel-editor.tsx",
                                        lineNumber: 93,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        value: selected.description,
                                        onChange: (e)=>updateModel({
                                                ...selected,
                                                description: e.target.value
                                            }),
                                        readOnly: selectedLocked,
                                        placeholder: "What does this structure represent?",
                                        className: "w-full border-0 bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/70 read-only:cursor-default"
                                    }, void 0, false, {
                                        fileName: "[project]/components/structure-excel-editor.tsx",
                                        lineNumber: 100,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/structure-excel-editor.tsx",
                                lineNumber: 92,
                                columnNumber: 11
                            }, this),
                            models.length > 1 && !selectedLocked && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                size: "icon",
                                variant: "ghost",
                                className: "h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive",
                                onClick: ()=>deleteModel(selected.id),
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__["Trash2"], {
                                    className: "h-4 w-4"
                                }, void 0, false, {
                                    fileName: "[project]/components/structure-excel-editor.tsx",
                                    lineNumber: 115,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/structure-excel-editor.tsx",
                                lineNumber: 109,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/structure-excel-editor.tsx",
                        lineNumber: 91,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/structure-excel-editor.tsx",
                lineNumber: 78,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "min-h-0 flex-1 overflow-auto",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                        className: "w-full min-w-[720px] border-collapse text-[11.5px]",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                className: "sticky top-0 z-10",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                    className: "bg-secondary/80 backdrop-blur-sm",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "w-9 border-b border-r border-border px-1 py-1.5 text-center text-[10px] font-medium text-muted-foreground",
                                            children: "#"
                                        }, void 0, false, {
                                            fileName: "[project]/components/structure-excel-editor.tsx",
                                            lineNumber: 126,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "min-w-[140px] border-b border-r border-border px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                                            children: "Field name"
                                        }, void 0, false, {
                                            fileName: "[project]/components/structure-excel-editor.tsx",
                                            lineNumber: 129,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "min-w-[150px] border-b border-r border-border px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                                            children: "Data type"
                                        }, void 0, false, {
                                            fileName: "[project]/components/structure-excel-editor.tsx",
                                            lineNumber: 132,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "min-w-[180px] border-b border-r border-border px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                                            children: "Description"
                                        }, void 0, false, {
                                            fileName: "[project]/components/structure-excel-editor.tsx",
                                            lineNumber: 135,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "min-w-[120px] border-b border-r border-border px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                                            children: "Example"
                                        }, void 0, false, {
                                            fileName: "[project]/components/structure-excel-editor.tsx",
                                            lineNumber: 138,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "w-20 border-b border-r border-border px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                                            children: "Required"
                                        }, void 0, false, {
                                            fileName: "[project]/components/structure-excel-editor.tsx",
                                            lineNumber: 141,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "w-10 border-b border-border px-1 py-1.5"
                                        }, void 0, false, {
                                            fileName: "[project]/components/structure-excel-editor.tsx",
                                            lineNumber: 144,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/structure-excel-editor.tsx",
                                    lineNumber: 125,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/structure-excel-editor.tsx",
                                lineNumber: 124,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                children: selected.fields.map((f, rowIdx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(FieldRow, {
                                        field: f,
                                        fields: selected.fields,
                                        rowIdx: rowIdx,
                                        locked: selectedLocked,
                                        models: models,
                                        selectedId: selected.id,
                                        onUpdate: (patch)=>updateField(f.id, patch),
                                        onRemove: ()=>removeField(f.id)
                                    }, f.id, false, {
                                        fileName: "[project]/components/structure-excel-editor.tsx",
                                        lineNumber: 149,
                                        columnNumber: 15
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/components/structure-excel-editor.tsx",
                                lineNumber: 147,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/structure-excel-editor.tsx",
                        lineNumber: 123,
                        columnNumber: 9
                    }, this),
                    !selectedLocked && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "border-t border-border px-3 py-2",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                            variant: "ghost",
                            size: "sm",
                            className: "h-7 text-xs",
                            onClick: addField,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                    className: "mr-1 h-3.5 w-3.5"
                                }, void 0, false, {
                                    fileName: "[project]/components/structure-excel-editor.tsx",
                                    lineNumber: 167,
                                    columnNumber: 15
                                }, this),
                                " Add row"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/structure-excel-editor.tsx",
                            lineNumber: 166,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/structure-excel-editor.tsx",
                        lineNumber: 165,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/structure-excel-editor.tsx",
                lineNumber: 122,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/structure-excel-editor.tsx",
        lineNumber: 76,
        columnNumber: 5
    }, this);
}
_s(StructureExcelEditor, "PTI97KDXfQS6WUdisps1JE+ZMwM=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useStore"]
    ];
});
_c = StructureExcelEditor;
function FieldRow({ field, fields, rowIdx, locked, models, selectedId, onUpdate, onRemove }) {
    const stripe = rowIdx % 2 === 1;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("group", stripe && "bg-secondary/15"),
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                        className: "border-b border-r border-border bg-secondary/25 px-1 py-0 text-center text-[10px] text-muted-foreground",
                        children: rowIdx + 1
                    }, void 0, false, {
                        fileName: "[project]/components/structure-excel-editor.tsx",
                        lineNumber: 193,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                        className: "border-b border-r border-border p-0",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CellInput, {
                            value: field.name,
                            onChange: (v)=>onUpdate({
                                    name: v
                                }),
                            placeholder: "e.g. Company name",
                            locked: locked
                        }, void 0, false, {
                            fileName: "[project]/components/structure-excel-editor.tsx",
                            lineNumber: 197,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/structure-excel-editor.tsx",
                        lineNumber: 196,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                        className: "border-b border-r border-border p-0 align-top",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "px-1 py-1",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$field$2d$type$2d$editor$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureFieldTypeEditor"], {
                                field: field,
                                fields: fields,
                                models: models,
                                selectedId: selectedId,
                                locked: locked,
                                onUpdate: onUpdate
                            }, void 0, false, {
                                fileName: "[project]/components/structure-excel-editor.tsx",
                                lineNumber: 206,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/components/structure-excel-editor.tsx",
                            lineNumber: 205,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/structure-excel-editor.tsx",
                        lineNumber: 204,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                        className: "border-b border-r border-border p-0",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CellInput, {
                            value: field.description,
                            onChange: (v)=>onUpdate({
                                    description: v
                                }),
                            placeholder: "What should go here?",
                            locked: locked
                        }, void 0, false, {
                            fileName: "[project]/components/structure-excel-editor.tsx",
                            lineNumber: 217,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/structure-excel-editor.tsx",
                        lineNumber: 216,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                        className: "border-b border-r border-border p-0",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CellInput, {
                            value: field.example ?? "",
                            onChange: (v)=>onUpdate({
                                    example: v || undefined
                                }),
                            placeholder: "Sample value",
                            locked: locked,
                            mono: true
                        }, void 0, false, {
                            fileName: "[project]/components/structure-excel-editor.tsx",
                            lineNumber: 225,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/structure-excel-editor.tsx",
                        lineNumber: 224,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                        className: "border-b border-r border-border p-0 text-center",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            disabled: locked,
                            onClick: ()=>onUpdate({
                                    optional: !field.optional
                                }),
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("mx-auto flex h-6 w-14 items-center justify-center rounded text-[10px] font-medium transition-colors", field.optional ? "bg-secondary text-muted-foreground" : "bg-primary/15 text-primary", locked && "cursor-default opacity-70"),
                            children: field.optional ? "Optional" : "Required"
                        }, void 0, false, {
                            fileName: "[project]/components/structure-excel-editor.tsx",
                            lineNumber: 234,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/structure-excel-editor.tsx",
                        lineNumber: 233,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                        className: "border-b border-border p-0 text-center",
                        children: !locked && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: onRemove,
                            className: "px-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__["Trash2"], {
                                className: "h-3.5 w-3.5"
                            }, void 0, false, {
                                fileName: "[project]/components/structure-excel-editor.tsx",
                                lineNumber: 256,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/components/structure-excel-editor.tsx",
                            lineNumber: 251,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/structure-excel-editor.tsx",
                        lineNumber: 249,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/structure-excel-editor.tsx",
                lineNumber: 192,
                columnNumber: 7
            }, this),
            field.type === "json" && !field.typeExpr && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(stripe && "bg-secondary/15"),
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                        className: "border-b border-r border-border bg-secondary/25"
                    }, void 0, false, {
                        fileName: "[project]/components/structure-excel-editor.tsx",
                        lineNumber: 263,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                        colSpan: 6,
                        className: "border-b border-border px-2 py-1 text-[10px] text-amber-700 dark:text-amber-500",
                        children: [
                            "Flexible data stores anything — prefer “",
                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$field$2d$labels$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fieldTypeLabel"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Model),
                            "” or a Type from the sidebar."
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/structure-excel-editor.tsx",
                        lineNumber: 264,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/structure-excel-editor.tsx",
                lineNumber: 262,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true);
}
_c1 = FieldRow;
function CellInput({ value, onChange, placeholder, locked, mono }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
        value: value,
        onChange: (e)=>onChange(e.target.value),
        readOnly: locked,
        placeholder: placeholder,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("h-8 w-full border-0 bg-transparent px-2 text-[11.5px] outline-none placeholder:text-muted-foreground/50 read-only:cursor-default", mono && "font-mono")
    }, void 0, false, {
        fileName: "[project]/components/structure-excel-editor.tsx",
        lineNumber: 287,
        columnNumber: 5
    }, this);
}
_c2 = CellInput;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "StructureExcelEditor");
__turbopack_context__.k.register(_c1, "FieldRow");
__turbopack_context__.k.register(_c2, "CellInput");
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
"[project]/components/structure-source-doc-link.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "StructureSourceDocLink",
    ()=>StructureSourceDocLink
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$open$2d$in$2d$documents$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/open-in-documents.tsx [app-client] (ecmascript)");
"use client";
;
;
function StructureSourceDocLink({ sourceDocId, className }) {
    if (!sourceDocId) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$open$2d$in$2d$documents$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OpenInDocumentsLink"], {
        docId: sourceDocId,
        variant: "source",
        className: className,
        stopPropagation: false
    }, void 0, false, {
        fileName: "[project]/components/structure-source-doc-link.tsx",
        lineNumber: 15,
        columnNumber: 10
    }, this);
}
_c = StructureSourceDocLink;
var _c;
__turbopack_context__.k.register(_c, "StructureSourceDocLink");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/type-expr-edit.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TYPE_KIND_OPTIONS",
    ()=>TYPE_KIND_OPTIONS,
    "appendTupleArg",
    ()=>appendTupleArg,
    "appendUnionVariant",
    ()=>appendUnionVariant,
    "childPaths",
    ()=>childPaths,
    "exprFromKindPick",
    ()=>exprFromKindPick,
    "getAtPath",
    ()=>getAtPath,
    "removeChildAt",
    ()=>removeChildAt,
    "setAtPath",
    ()=>setAtPath,
    "typeExprHasUnset",
    ()=>typeExprHasUnset
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/type_expr.ts [app-client] (ecmascript)");
;
const TYPE_KIND_OPTIONS = [
    {
        id: "list",
        label: "list[…]",
        hint: "Homogeneous sequence"
    },
    {
        id: "dict",
        label: "dict[K, V]",
        hint: "Key-value map"
    },
    {
        id: "set",
        label: "set[…]",
        hint: "Unique collection"
    },
    {
        id: "optional",
        label: "Optional[…]",
        hint: "May be absent"
    },
    {
        id: "tuple",
        label: "tuple[…]",
        hint: "Fixed-length product"
    },
    {
        id: "union",
        label: "A | B",
        hint: "One of several types"
    },
    {
        id: "str",
        label: "str"
    },
    {
        id: "int",
        label: "int"
    },
    {
        id: "float",
        label: "float"
    },
    {
        id: "bool",
        label: "bool"
    },
    {
        id: "datetime",
        label: "datetime"
    },
    {
        id: "json",
        label: "json"
    },
    {
        id: "document",
        label: "Document"
    },
    {
        id: "quote",
        label: "Quote"
    },
    {
        id: "text_quote",
        label: "TextQuote"
    },
    {
        id: "model",
        label: "Structure model"
    },
    {
        id: "named",
        label: "Custom name",
        hint: "e.g. quote_id_t"
    },
    {
        id: "unset",
        label: "UNSET",
        hint: "Placeholder slot"
    }
];
function exprFromKindPick(pick, models, modelId) {
    switch(pick){
        case "unset":
            return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"];
        case "str":
            return {
                kind: "prim",
                name: "text"
            };
        case "int":
            return {
                kind: "prim",
                name: "int"
            };
        case "float":
            return {
                kind: "prim",
                name: "float"
            };
        case "bool":
            return {
                kind: "prim",
                name: "bool"
            };
        case "datetime":
            return {
                kind: "prim",
                name: "datetime"
            };
        case "json":
            return {
                kind: "prim",
                name: "json"
            };
        case "document":
            return {
                kind: "document"
            };
        case "quote":
            return {
                kind: "quote"
            };
        case "text_quote":
            return {
                kind: "text_quote"
            };
        case "list":
            return {
                kind: "list",
                item: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"]
            };
        case "dict":
            return {
                kind: "map",
                key: {
                    kind: "prim",
                    name: "text"
                },
                value: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"]
            };
        case "set":
            return {
                kind: "set",
                item: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"]
            };
        case "optional":
            return {
                kind: "optional",
                inner: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"]
            };
        case "tuple":
            return {
                kind: "generic",
                name: "tuple",
                args: [
                    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"],
                    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"]
                ]
            };
        case "union":
            return {
                kind: "union",
                variants: [
                    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"],
                    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"]
                ]
            };
        case "named":
            return {
                kind: "named",
                name: "quote_id_t"
            };
        case "model":
            {
                const id = modelId ?? models[0]?.id;
                return id ? {
                    kind: "ref",
                    modelId: id
                } : __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"];
            }
    }
}
function getAtPath(root, path) {
    let cur = root;
    for (const idx of path){
        cur = childAt(cur, idx);
    }
    return cur;
}
function setAtPath(root, path, next) {
    if (!path.length) return next;
    const [head, ...rest] = path;
    return mapChild(root, head, (child)=>setAtPath(child, rest, next));
}
function childAt(expr, index) {
    switch(expr.kind){
        case "list":
        case "set":
        case "optional":
            return index === 0 ? slotOf(expr) : __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"];
        case "map":
            return index === 0 ? expr.key : index === 1 ? expr.value : __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"];
        case "union":
            return expr.variants[index] ?? __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"];
        case "generic":
            return expr.args[index] ?? __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"];
        default:
            return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"];
    }
}
function slotOf(expr) {
    if (expr.kind === "list" || expr.kind === "set") return expr.item;
    if (expr.kind === "optional") return expr.inner;
    return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"];
}
function mapChild(expr, index, fn) {
    switch(expr.kind){
        case "list":
            return {
                ...expr,
                item: fn(expr.item)
            };
        case "set":
            return {
                ...expr,
                item: fn(expr.item)
            };
        case "optional":
            return {
                ...expr,
                inner: fn(expr.inner)
            };
        case "map":
            if (index === 0) return {
                ...expr,
                key: fn(expr.key)
            };
            if (index === 1) return {
                ...expr,
                value: fn(expr.value)
            };
            return expr;
        case "union":
            {
                const variants = [
                    ...expr.variants
                ];
                variants[index] = fn(variants[index] ?? __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"]);
                return {
                    ...expr,
                    variants
                };
            }
        case "generic":
            {
                const args = [
                    ...expr.args
                ];
                args[index] = fn(args[index] ?? __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"]);
                return {
                    ...expr,
                    args
                };
            }
        default:
            return expr;
    }
}
function appendUnionVariant(root, path) {
    const target = getAtPath(root, path);
    if (target.kind !== "union") return root;
    return setAtPath(root, path, {
        ...target,
        variants: [
            ...target.variants,
            __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"]
        ]
    });
}
function appendTupleArg(root, path) {
    const target = getAtPath(root, path);
    if (target.kind !== "generic" || target.name !== "tuple") return root;
    return setAtPath(root, path, {
        ...target,
        args: [
            ...target.args,
            __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"]
        ]
    });
}
function removeChildAt(root, path, index) {
    const target = getAtPath(root, path);
    if (target.kind === "union" && target.variants.length > 2) {
        return setAtPath(root, path, {
            ...target,
            variants: target.variants.filter((_, i)=>i !== index)
        });
    }
    if (target.kind === "generic" && target.name === "tuple" && target.args.length > 2) {
        return setAtPath(root, path, {
            ...target,
            args: target.args.filter((_, i)=>i !== index)
        });
    }
    return root;
}
function childPaths(expr, base = []) {
    switch(expr.kind){
        case "list":
        case "set":
            return [
                {
                    label: "item",
                    path: [
                        ...base,
                        0
                    ]
                }
            ];
        case "optional":
            return [
                {
                    label: "inner",
                    path: [
                        ...base,
                        0
                    ]
                }
            ];
        case "map":
            return [
                {
                    label: "key",
                    path: [
                        ...base,
                        0
                    ]
                },
                {
                    label: "value",
                    path: [
                        ...base,
                        1
                    ]
                }
            ];
        case "union":
            return expr.variants.map((_, i)=>({
                    label: `opt ${i + 1}`,
                    path: [
                        ...base,
                        i
                    ]
                }));
        case "generic":
            if (expr.name === "tuple") {
                return expr.args.map((_, i)=>({
                        label: `#${i + 1}`,
                        path: [
                            ...base,
                            i
                        ]
                    }));
            }
            return expr.args.map((_, i)=>({
                    label: `arg ${i + 1}`,
                    path: [
                        ...base,
                        i
                    ]
                }));
        default:
            return [];
    }
}
function typeExprHasUnset(expr) {
    if (expr.kind === "unset") return true;
    switch(expr.kind){
        case "list":
        case "set":
            return typeExprHasUnset(expr.item);
        case "optional":
            return typeExprHasUnset(expr.inner);
        case "map":
            return typeExprHasUnset(expr.key) || typeExprHasUnset(expr.value);
        case "union":
            return expr.variants.some(typeExprHasUnset);
        case "generic":
            return expr.args.some(typeExprHasUnset);
        default:
            return false;
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/type-expr-preview.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TypeAliasPreview",
    ()=>TypeAliasPreview,
    "TypeExprHighlight",
    ()=>TypeExprHighlight
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/type_expr.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
"use client";
;
;
;
const TYPE_TOKEN_RE = /(\[\]|\||<|>|,|\[|\]|\(|\)|=|\s+|type\b|[A-Za-z_]\w*)/g;
const KEYWORDS = new Set([
    "Optional",
    "Union",
    "list",
    "dict",
    "tuple",
    "set",
    "Record",
    "Set",
    "type"
]);
const PRIMS = new Set([
    "str",
    "int",
    "float",
    "bool",
    "string",
    "number",
    "boolean",
    "never",
    "undefined",
    "unknown",
    "Any",
    "null"
]);
const SPECIAL = new Set([
    "Document",
    "Quote",
    "TextQuote",
    "FileInput"
]);
function tokenKind(token) {
    if (/^\s+$/.test(token)) return "plain";
    if (/^[\[\]|<>(),=]$/.test(token) || token === "[]") return "punct";
    if (token === "type") return "keyword";
    if (token === "UNSET") return "unset";
    if (KEYWORDS.has(token)) return "keyword";
    if (PRIMS.has(token)) return "prim";
    if (SPECIAL.has(token)) return "special";
    if (/^[A-Za-z_]\w*$/.test(token)) return "typeName";
    return "plain";
}
const TOKEN_CLASS = {
    punct: "text-muted-foreground/60",
    keyword: "text-chart-4",
    prim: "text-chart-3",
    special: "text-chart-2",
    typeName: "text-primary",
    unset: "text-amber-500 dark:text-amber-400",
    plain: "text-foreground"
};
function TypeExprHighlight({ text, className }) {
    const tokens = text.match(TYPE_TOKEN_RE) ?? [
        text
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("overflow-x-auto font-mono text-[11px] leading-relaxed", className),
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("code", {
            children: tokens.map((token, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: TOKEN_CLASS[tokenKind(token)],
                    children: token
                }, i, false, {
                    fileName: "[project]/components/type-expr-preview.tsx",
                    lineNumber: 75,
                    columnNumber: 11
                }, this))
        }, void 0, false, {
            fileName: "[project]/components/type-expr-preview.tsx",
            lineNumber: 73,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/type-expr-preview.tsx",
        lineNumber: 72,
        columnNumber: 5
    }, this);
}
_c = TypeExprHighlight;
function aliasDeclarationPy(name, expr, models) {
    const body = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["typeExprToPy"])(expr, models);
    const label = name.trim();
    return label ? `type ${label} = ${body}` : body;
}
function aliasDeclarationTs(name, expr, models) {
    const body = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["typeExprToTs"])(expr, models);
    const label = name.trim();
    return label ? `type ${label} = ${body}` : body;
}
function TypeAliasPreview({ name, expr, models, className }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("grid gap-3 sm:grid-cols-2", className),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-md border border-border bg-[oklch(0.14_0.004_264)] p-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground",
                        children: "Python"
                    }, void 0, false, {
                        fileName: "[project]/components/type-expr-preview.tsx",
                        lineNumber: 110,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TypeExprHighlight, {
                        text: aliasDeclarationPy(name ?? "", expr, models)
                    }, void 0, false, {
                        fileName: "[project]/components/type-expr-preview.tsx",
                        lineNumber: 113,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/type-expr-preview.tsx",
                lineNumber: 109,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-md border border-border bg-[oklch(0.14_0.004_264)] p-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground",
                        children: "TypeScript"
                    }, void 0, false, {
                        fileName: "[project]/components/type-expr-preview.tsx",
                        lineNumber: 116,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TypeExprHighlight, {
                        text: aliasDeclarationTs(name ?? "", expr, models)
                    }, void 0, false, {
                        fileName: "[project]/components/type-expr-preview.tsx",
                        lineNumber: 119,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/type-expr-preview.tsx",
                lineNumber: 115,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/type-expr-preview.tsx",
        lineNumber: 108,
        columnNumber: 5
    }, this);
}
_c1 = TypeAliasPreview;
var _c, _c1;
__turbopack_context__.k.register(_c, "TypeExprHighlight");
__turbopack_context__.k.register(_c1, "TypeAliasPreview");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/type-expr-editor.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TypeExprEditor",
    ()=>TypeExprEditor,
    "defaultPlaygroundExpr",
    ()=>defaultPlaygroundExpr
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/plus.mjs [app-client] (ecmascript) <export default as Plus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trash-2.mjs [app-client] (ecmascript) <export default as Trash2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/dropdown-menu.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/type-expr-edit.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$parse$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/type-expr-parse.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$type$2d$expr$2d$preview$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/type-expr-preview.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/type_expr.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
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
function kindLabel(expr, models) {
    switch(expr.kind){
        case "prim":
            return expr.name === "text" ? "str" : expr.name;
        case "list":
            return "list";
        case "map":
            return "dict";
        case "set":
            return "set";
        case "optional":
            return "Optional";
        case "union":
            return "union";
        case "generic":
            return expr.name === "tuple" ? "tuple" : expr.name;
        case "ref":
            return models.find((m)=>m.id === expr.modelId)?.name ?? "model";
        case "named":
            return expr.name;
        case "unset":
            return "UNSET";
        case "document":
            return "Document";
        case "quote":
            return "Quote";
        case "text_quote":
            return "TextQuote";
        default:
            return expr.kind;
    }
}
function KindPicker({ models, typeAliases = [], onPick, className, children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenu"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuTrigger"], {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("inline-flex", className),
                children: children
            }, void 0, false, {
                fileName: "[project]/components/type-expr-editor.tsx",
                lineNumber: 83,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuContent"], {
                align: "start",
                className: "max-h-72 w-52 overflow-y-auto",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuGroup"], {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuLabel"], {
                            className: "font-mono text-[10px] uppercase tracking-wider",
                            children: "Insert type"
                        }, void 0, false, {
                            fileName: "[project]/components/type-expr-editor.tsx",
                            lineNumber: 86,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/type-expr-editor.tsx",
                        lineNumber: 85,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuSeparator"], {}, void 0, false, {
                        fileName: "[project]/components/type-expr-editor.tsx",
                        lineNumber: 90,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuGroup"], {
                        children: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TYPE_KIND_OPTIONS"].map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuItem"], {
                                className: "font-mono text-xs",
                                onClick: ()=>onPick(opt.id),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: opt.label
                                    }, void 0, false, {
                                        fileName: "[project]/components/type-expr-editor.tsx",
                                        lineNumber: 98,
                                        columnNumber: 15
                                    }, this),
                                    opt.hint && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "ml-auto text-[10px] text-muted-foreground",
                                        children: opt.hint
                                    }, void 0, false, {
                                        fileName: "[project]/components/type-expr-editor.tsx",
                                        lineNumber: 99,
                                        columnNumber: 28
                                    }, this)
                                ]
                            }, opt.id, true, {
                                fileName: "[project]/components/type-expr-editor.tsx",
                                lineNumber: 93,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/components/type-expr-editor.tsx",
                        lineNumber: 91,
                        columnNumber: 9
                    }, this),
                    typeAliases.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuSeparator"], {}, void 0, false, {
                                fileName: "[project]/components/type-expr-editor.tsx",
                                lineNumber: 105,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuGroup"], {
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuLabel"], {
                                    className: "font-mono text-[10px] uppercase tracking-wider",
                                    children: "Project types"
                                }, void 0, false, {
                                    fileName: "[project]/components/type-expr-editor.tsx",
                                    lineNumber: 107,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/type-expr-editor.tsx",
                                lineNumber: 106,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuGroup"], {
                                children: typeAliases.map((t)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuItem"], {
                                        className: "font-mono text-xs",
                                        onClick: ()=>onPick("named", undefined, t.name),
                                        children: t.name
                                    }, t.id, false, {
                                        fileName: "[project]/components/type-expr-editor.tsx",
                                        lineNumber: 113,
                                        columnNumber: 17
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/components/type-expr-editor.tsx",
                                lineNumber: 111,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true),
                    models.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuSeparator"], {}, void 0, false, {
                                fileName: "[project]/components/type-expr-editor.tsx",
                                lineNumber: 126,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuGroup"], {
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuLabel"], {
                                    className: "font-mono text-[10px] uppercase tracking-wider",
                                    children: "Models"
                                }, void 0, false, {
                                    fileName: "[project]/components/type-expr-editor.tsx",
                                    lineNumber: 128,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/type-expr-editor.tsx",
                                lineNumber: 127,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuGroup"], {
                                children: models.map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dropdown$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropdownMenuItem"], {
                                        className: "font-mono text-xs",
                                        onClick: ()=>onPick("model", m.id),
                                        children: m.name
                                    }, m.id, false, {
                                        fileName: "[project]/components/type-expr-editor.tsx",
                                        lineNumber: 134,
                                        columnNumber: 17
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/components/type-expr-editor.tsx",
                                lineNumber: 132,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true)
                ]
            }, void 0, true, {
                fileName: "[project]/components/type-expr-editor.tsx",
                lineNumber: 84,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/type-expr-editor.tsx",
        lineNumber: 82,
        columnNumber: 5
    }, this);
}
_c = KindPicker;
function TypeExprNode({ expr, path, models, typeAliases, depth, onChange }) {
    const node = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAtPath"])(expr, path);
    const replace = (next)=>onChange((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setAtPath"])(expr, path, next));
    const pickType = (pick, modelId, aliasName)=>{
        if (aliasName) replace({
            kind: "named",
            name: aliasName
        });
        else replace((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["exprFromKindPick"])(pick, models, modelId));
    };
    if (node.kind === "unset") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(KindPicker, {
            models: models,
            typeAliases: typeAliases,
            onPick: pickType,
            className: "rounded-md border border-dashed border-primary/50 bg-primary/5 px-2 py-1 font-mono text-[11px] text-primary hover:bg-primary/10",
            children: "+ pick type"
        }, void 0, false, {
            fileName: "[project]/components/type-expr-editor.tsx",
            lineNumber: 175,
            columnNumber: 7
        }, this);
    }
    if (node.kind === "named") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "inline-flex items-center gap-1",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                    value: node.name,
                    onChange: (e)=>replace({
                            kind: "named",
                            name: e.target.value || "custom_t"
                        }),
                    className: "h-7 w-32 font-mono text-[11px]"
                }, void 0, false, {
                    fileName: "[project]/components/type-expr-editor.tsx",
                    lineNumber: 189,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(KindPicker, {
                    models: models,
                    typeAliases: typeAliases,
                    onPick: pickType,
                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["buttonVariants"])({
                        variant: "ghost",
                        size: "sm"
                    }), "h-7 px-2 font-mono text-[10px]"),
                    children: "change"
                }, void 0, false, {
                    fileName: "[project]/components/type-expr-editor.tsx",
                    lineNumber: 194,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/type-expr-editor.tsx",
            lineNumber: 188,
            columnNumber: 7
        }, this);
    }
    if (node.kind === "ref") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "inline-flex items-center gap-1",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                    value: node.modelId,
                    onChange: (e)=>replace({
                            kind: "ref",
                            modelId: e.target.value
                        }),
                    className: "h-7 rounded-md border border-border bg-background px-2 font-mono text-[11px]",
                    children: models.map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                            value: m.id,
                            children: m.name
                        }, m.id, false, {
                            fileName: "[project]/components/type-expr-editor.tsx",
                            lineNumber: 215,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/components/type-expr-editor.tsx",
                    lineNumber: 209,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(KindPicker, {
                    models: models,
                    typeAliases: typeAliases,
                    onPick: pickType,
                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["buttonVariants"])({
                        variant: "ghost",
                        size: "sm"
                    }), "h-7 px-2 font-mono text-[10px]"),
                    children: "change"
                }, void 0, false, {
                    fileName: "[project]/components/type-expr-editor.tsx",
                    lineNumber: 220,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/type-expr-editor.tsx",
            lineNumber: 208,
            columnNumber: 7
        }, this);
    }
    if (node.kind === "prim" || node.kind === "document" || node.kind === "quote" || node.kind === "text_quote") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "inline-flex items-center gap-1 rounded-md border border-border bg-secondary/30 px-2 py-1",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "font-mono text-[11px]",
                    children: kindLabel(node, models)
                }, void 0, false, {
                    fileName: "[project]/components/type-expr-editor.tsx",
                    lineNumber: 235,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(KindPicker, {
                    models: models,
                    typeAliases: typeAliases,
                    onPick: pickType,
                    className: "font-mono text-[10px] text-muted-foreground hover:text-foreground",
                    children: "edit"
                }, void 0, false, {
                    fileName: "[project]/components/type-expr-editor.tsx",
                    lineNumber: 236,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/type-expr-editor.tsx",
            lineNumber: 234,
            columnNumber: 7
        }, this);
    }
    const containerLabel = kindLabel(node, models);
    const isUnion = node.kind === "union";
    const isTuple = node.kind === "generic" && node.name === "tuple";
    const children = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["childPaths"])(node, []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("inline-flex flex-col gap-1.5 rounded-lg border border-border bg-card/40 p-2", depth > 0 && "ml-1"),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-wrap items-center gap-1.5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "font-mono text-[10px] uppercase tracking-wider text-muted-foreground",
                        children: containerLabel
                    }, void 0, false, {
                        fileName: "[project]/components/type-expr-editor.tsx",
                        lineNumber: 261,
                        columnNumber: 9
                    }, this),
                    (isUnion || isTuple) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        type: "button",
                        size: "sm",
                        variant: "ghost",
                        className: "h-6 gap-1 px-1.5 font-mono text-[10px]",
                        onClick: ()=>onChange(isUnion ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["appendUnionVariant"])(expr, path) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["appendTupleArg"])(expr, path)),
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                className: "h-3 w-3"
                            }, void 0, false, {
                                fileName: "[project]/components/type-expr-editor.tsx",
                                lineNumber: 274,
                                columnNumber: 13
                            }, this),
                            "add"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/type-expr-editor.tsx",
                        lineNumber: 265,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(KindPicker, {
                        models: models,
                        typeAliases: typeAliases,
                        onPick: pickType,
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["buttonVariants"])({
                            variant: "ghost",
                            size: "sm"
                        }), "h-6 px-1.5 font-mono text-[10px]"),
                        children: "wrap"
                    }, void 0, false, {
                        fileName: "[project]/components/type-expr-editor.tsx",
                        lineNumber: 278,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/type-expr-editor.tsx",
                lineNumber: 260,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-col gap-2 border-l border-border/60 pl-2",
                children: children.map(({ label, path: childRel })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap items-start gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "mt-1 shrink-0 font-mono text-[9px] uppercase text-muted-foreground",
                                children: label
                            }, void 0, false, {
                                fileName: "[project]/components/type-expr-editor.tsx",
                                lineNumber: 290,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TypeExprNode, {
                                expr: expr,
                                path: [
                                    ...path,
                                    ...childRel
                                ],
                                models: models,
                                typeAliases: typeAliases,
                                depth: depth + 1,
                                onChange: onChange
                            }, void 0, false, {
                                fileName: "[project]/components/type-expr-editor.tsx",
                                lineNumber: 293,
                                columnNumber: 13
                            }, this),
                            (isUnion || isTuple) && children.length > 2 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                type: "button",
                                size: "icon",
                                variant: "ghost",
                                className: "h-6 w-6 text-muted-foreground hover:text-destructive",
                                onClick: ()=>onChange((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["removeChildAt"])(expr, path, childRel[0])),
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__["Trash2"], {
                                    className: "h-3 w-3"
                                }, void 0, false, {
                                    fileName: "[project]/components/type-expr-editor.tsx",
                                    lineNumber: 309,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/type-expr-editor.tsx",
                                lineNumber: 302,
                                columnNumber: 15
                            }, this)
                        ]
                    }, childRel.join("."), true, {
                        fileName: "[project]/components/type-expr-editor.tsx",
                        lineNumber: 289,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/components/type-expr-editor.tsx",
                lineNumber: 287,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/type-expr-editor.tsx",
        lineNumber: 254,
        columnNumber: 5
    }, this);
}
_c1 = TypeExprNode;
function TypeExprEditor({ expr, models, typeAliases = [], onChange, className }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("space-y-3", className),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TypeExprNode, {
                expr: expr,
                path: [],
                models: models,
                typeAliases: typeAliases,
                depth: 0,
                onChange: onChange
            }, void 0, false, {
                fileName: "[project]/components/type-expr-editor.tsx",
                lineNumber: 334,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$type$2d$expr$2d$preview$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TypeExprHighlight"], {
                text: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$parse$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatTypeExprPy"])(expr, models),
                className: "text-[11px]"
            }, void 0, false, {
                fileName: "[project]/components/type-expr-editor.tsx",
                lineNumber: 342,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/type-expr-editor.tsx",
        lineNumber: 333,
        columnNumber: 5
    }, this);
}
_c2 = TypeExprEditor;
function defaultPlaygroundExpr() {
    return {
        kind: "list",
        item: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"]
    };
}
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "KindPicker");
__turbopack_context__.k.register(_c1, "TypeExprNode");
__turbopack_context__.k.register(_c2, "TypeExprEditor");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/structure-type-alias-editor.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "StructureTypeAliasEditor",
    ()=>StructureTypeAliasEditor,
    "TypeAliasTextSync",
    ()=>TypeAliasTextSync
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trash-2.mjs [app-client] (ecmascript) <export default as Trash2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$type$2d$expr$2d$editor$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/type-expr-editor.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/type-expr-edit.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$parse$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/type-expr-parse.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$type$2d$expr$2d$preview$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/type-expr-preview.tsx [app-client] (ecmascript)");
"use client";
;
;
;
;
;
;
;
;
function StructureTypeAliasEditor({ alias, models, typeAliases = [], locked, onUpdate, onDelete }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-5",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-start gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex-1 space-y-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                value: alias.name,
                                onChange: (e)=>onUpdate({
                                        name: e.target.value
                                    }),
                                readOnly: locked,
                                placeholder: "Type name — e.g. quote_id_t",
                                className: "h-9 font-mono text-sm font-medium"
                            }, void 0, false, {
                                fileName: "[project]/components/structure-type-alias-editor.tsx",
                                lineNumber: 31,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                value: alias.description,
                                onChange: (e)=>onUpdate({
                                        description: e.target.value
                                    }),
                                readOnly: locked,
                                placeholder: "What this type represents…",
                                className: "h-8 text-xs text-muted-foreground"
                            }, void 0, false, {
                                fileName: "[project]/components/structure-type-alias-editor.tsx",
                                lineNumber: 38,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/structure-type-alias-editor.tsx",
                        lineNumber: 30,
                        columnNumber: 9
                    }, this),
                    !locked && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        size: "icon",
                        variant: "ghost",
                        className: "h-9 w-9 text-muted-foreground hover:text-destructive",
                        onClick: onDelete,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__["Trash2"], {
                            className: "h-4 w-4"
                        }, void 0, false, {
                            fileName: "[project]/components/structure-type-alias-editor.tsx",
                            lineNumber: 53,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/structure-type-alias-editor.tsx",
                        lineNumber: 47,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/structure-type-alias-editor.tsx",
                lineNumber: 29,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-lg border border-border bg-secondary/10 p-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground",
                        children: "Type expression"
                    }, void 0, false, {
                        fileName: "[project]/components/structure-type-alias-editor.tsx",
                        lineNumber: 59,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$type$2d$expr$2d$editor$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TypeExprEditor"], {
                        expr: alias.expr,
                        models: models,
                        typeAliases: typeAliases.filter((t)=>t.id !== alias.id),
                        onChange: (expr)=>onUpdate({
                                expr
                            })
                    }, void 0, false, {
                        fileName: "[project]/components/structure-type-alias-editor.tsx",
                        lineNumber: 62,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/structure-type-alias-editor.tsx",
                lineNumber: 58,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$type$2d$expr$2d$preview$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TypeAliasPreview"], {
                name: alias.name,
                expr: alias.expr,
                models: models
            }, void 0, false, {
                fileName: "[project]/components/structure-type-alias-editor.tsx",
                lineNumber: 70,
                columnNumber: 7
            }, this),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["typeExprHasUnset"])(alias.expr) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "font-mono text-[10px] text-amber-600 dark:text-amber-500",
                children: [
                    "Fill every UNSET slot before using `",
                    alias.name || "this type",
                    "` in a struct field."
                ]
            }, void 0, true, {
                fileName: "[project]/components/structure-type-alias-editor.tsx",
                lineNumber: 73,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "font-mono text-[10px] text-muted-foreground",
                children: [
                    "Reference in struct fields as",
                    " ",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("code", {
                        className: "text-foreground",
                        children: alias.name || "TypeName"
                    }, void 0, false, {
                        fileName: "[project]/components/structure-type-alias-editor.tsx",
                        lineNumber: 80,
                        columnNumber: 9
                    }, this),
                    " or",
                    " ",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("code", {
                        className: "text-foreground",
                        children: [
                            "list[",
                            alias.name || "TypeName",
                            "]"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/structure-type-alias-editor.tsx",
                        lineNumber: 81,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/structure-type-alias-editor.tsx",
                lineNumber: 78,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/structure-type-alias-editor.tsx",
        lineNumber: 28,
        columnNumber: 5
    }, this);
}
_c = StructureTypeAliasEditor;
function TypeAliasTextSync({ alias, models, locked, onUpdate }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "font-mono text-[10px] uppercase tracking-wider text-muted-foreground",
                children: "Paste Python type text"
            }, void 0, false, {
                fileName: "[project]/components/structure-type-alias-editor.tsx",
                lineNumber: 100,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                defaultValue: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$parse$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatTypeExprPy"])(alias.expr, models),
                readOnly: locked,
                placeholder: "e.g. list[int] | dict[str, str]",
                className: "font-mono text-xs",
                onBlur: (e)=>{
                    const raw = e.target.value.trim();
                    if (!raw) return;
                    const parsed = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$parse$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tryParseTypeExprString"])(raw, models);
                    if (parsed.ok) onUpdate({
                        expr: parsed.expr
                    });
                },
                onKeyDown: (e)=>{
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const raw = e.currentTarget.value.trim();
                    if (!raw) return;
                    const parsed = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$parse$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tryParseTypeExprString"])(raw, models);
                    if (parsed.ok) onUpdate({
                        expr: parsed.expr
                    });
                }
            }, alias.id + (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$type$2d$expr$2d$parse$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatTypeExprPy"])(alias.expr, models), false, {
                fileName: "[project]/components/structure-type-alias-editor.tsx",
                lineNumber: 103,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/structure-type-alias-editor.tsx",
        lineNumber: 99,
        columnNumber: 5
    }, this);
}
_c1 = TypeAliasTextSync;
var _c, _c1;
__turbopack_context__.k.register(_c, "StructureTypeAliasEditor");
__turbopack_context__.k.register(_c1, "TypeAliasTextSync");
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
"[project]/components/structure-code-view.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "StructureCodeView",
    ()=>StructureCodeView
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$code$2d$viewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/code-viewer.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pydantic$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/pydantic.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pydantic$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/pydantic.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
function StructureCodeView({ models, typeAliases }) {
    _s();
    const sources = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "StructureCodeView.useMemo[sources]": ()=>[
                {
                    language: "python",
                    label: __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$code$2d$viewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CODE_LANG_LABEL"].python,
                    filename: "models.py",
                    content: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pydantic$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["allModelsToPydantic"])(models, typeAliases)
                },
                {
                    language: "typescript",
                    label: __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$code$2d$viewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CODE_LANG_LABEL"].typescript,
                    filename: "models.d.ts",
                    content: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$pydantic$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["allModelsToDts"])(models, typeAliases)
                }
            ]
    }["StructureCodeView.useMemo[sources]"], [
        models,
        typeAliases
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$code$2d$viewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MultiLangReadonlyCodeViewer"], {
        sources: sources,
        defaultLanguage: "python"
    }, void 0, false, {
        fileName: "[project]/components/structure-code-view.tsx",
        lineNumber: 37,
        columnNumber: 10
    }, this);
}
_s(StructureCodeView, "41LVsYOoq3E8q0McBAdSUKhtWF8=");
_c = StructureCodeView;
var _c;
__turbopack_context__.k.register(_c, "StructureCodeView");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/generated-types-panel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GeneratedTypesPanel",
    ()=>GeneratedTypesPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.mjs [app-client] (ecmascript) <export default as Loader2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/refresh-cw.mjs [app-client] (ecmascript) <export default as RefreshCw>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$code$2d$viewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/code-viewer.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api-client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$routes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api-routes.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/store.tsx [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
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
const FILE_TABS = [
    {
        id: "models",
        label: "Models"
    },
    {
        id: "pipeline",
        label: "Pipeline"
    }
];
const FILE_NAMES = {
    typescript: {
        models: "models.d.ts",
        pipeline: "pipeline_types.d.ts"
    },
    python: {
        models: "models.py",
        pipeline: "pipeline_types.py"
    }
};
function GeneratedTypesPanel() {
    _s();
    const { project } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useStore"])();
    const [files, setFiles] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [activeLang, setActiveLang] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("typescript");
    const [activeFileKind, setActiveFileKind] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("models");
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const activeFileName = FILE_NAMES[activeLang][activeFileKind];
    const load = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "GeneratedTypesPanel.useCallback[load]": async ()=>{
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$routes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["API_ROUTES"].projectTypes(project.id), {
                    headers: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["JSON_HEADERS"]
                });
                if (!res.ok) {
                    const data = await res.json().catch({
                        "GeneratedTypesPanel.useCallback[load]": ()=>({})
                    }["GeneratedTypesPanel.useCallback[load]"]);
                    throw new Error(data.error ?? `Failed to load types (${res.status})`);
                }
                const data = await res.json();
                setFiles(data.files);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load types");
            } finally{
                setLoading(false);
            }
        }
    }["GeneratedTypesPanel.useCallback[load]"], [
        project.id
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "GeneratedTypesPanel.useEffect": ()=>{
            void load();
        }
    }["GeneratedTypesPanel.useEffect"], [
        load
    ]);
    const activeContent = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "GeneratedTypesPanel.useMemo[activeContent]": ()=>files.find({
                "GeneratedTypesPanel.useMemo[activeContent]": (f)=>f.name === activeFileName
            }["GeneratedTypesPanel.useMemo[activeContent]"])?.content ?? ""
    }["GeneratedTypesPanel.useMemo[activeContent]"], [
        files,
        activeFileName
    ]);
    const langOptions = [
        "typescript",
        "python"
    ].map((id)=>({
            id,
            label: __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$code$2d$viewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CODE_LANG_LABEL"][id]
        }));
    const fileTabs = FILE_TABS.map((tab)=>({
            ...tab,
            sublabel: FILE_NAMES[activeLang][tab.id]
        }));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex min-h-0 flex-1 flex-col bg-[oklch(0.14_0.004_264)]",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between border-b border-border px-4 py-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "font-mono text-[10px] text-muted-foreground",
                        children: [
                            "Generated stubs — lint with ",
                            __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$code$2d$viewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CODE_LANG_LINT_HINT"][activeLang]
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/generated-types-panel.tsx",
                        lineNumber: 82,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        type: "button",
                        variant: "outline",
                        size: "sm",
                        className: "h-8 gap-1.5 font-mono text-[10px]",
                        onClick: ()=>void load(),
                        disabled: loading,
                        children: [
                            loading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                className: "h-3.5 w-3.5 animate-spin"
                            }, void 0, false, {
                                fileName: "[project]/components/generated-types-panel.tsx",
                                lineNumber: 93,
                                columnNumber: 22
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__["RefreshCw"], {
                                className: "h-3.5 w-3.5"
                            }, void 0, false, {
                                fileName: "[project]/components/generated-types-panel.tsx",
                                lineNumber: 93,
                                columnNumber: 73
                            }, this),
                            "Refresh"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/generated-types-panel.tsx",
                        lineNumber: 85,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/generated-types-panel.tsx",
                lineNumber: 81,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "border-b border-border px-4 py-3",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$code$2d$viewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CodeLanguageSwitch"], {
                    value: activeLang,
                    onChange: setActiveLang,
                    options: langOptions,
                    variant: "pill"
                }, void 0, false, {
                    fileName: "[project]/components/generated-types-panel.tsx",
                    lineNumber: 99,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/generated-types-panel.tsx",
                lineNumber: 98,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$code$2d$viewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CodeFileTabs"], {
                value: activeFileKind,
                onChange: setActiveFileKind,
                tabs: fileTabs
            }, void 0, false, {
                fileName: "[project]/components/generated-types-panel.tsx",
                lineNumber: 107,
                columnNumber: 7
            }, this),
            error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "p-4 font-mono text-xs text-destructive",
                children: error
            }, void 0, false, {
                fileName: "[project]/components/generated-types-panel.tsx",
                lineNumber: 110,
                columnNumber: 9
            }, this) : loading && !files.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-1 items-center justify-center",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                    className: "h-5 w-5 animate-spin text-muted-foreground"
                }, void 0, false, {
                    fileName: "[project]/components/generated-types-panel.tsx",
                    lineNumber: 113,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/generated-types-panel.tsx",
                lineNumber: 112,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$code$2d$viewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MonacoCodeEditor"], {
                value: activeContent,
                language: activeLang,
                readOnly: true
            }, void 0, false, {
                fileName: "[project]/components/generated-types-panel.tsx",
                lineNumber: 116,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/generated-types-panel.tsx",
        lineNumber: 80,
        columnNumber: 5
    }, this);
}
_s(GeneratedTypesPanel, "+Hx91jAg2vvSSSaRacC9M82jpGc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useStore"]
    ];
});
_c = GeneratedTypesPanel;
var _c;
__turbopack_context__.k.register(_c, "GeneratedTypesPanel");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/structure-types-code-section.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "StructureTypesCodeSection",
    ()=>StructureTypesCodeSection
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$code$2d$view$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/structure-code-view.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$generated$2d$types$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/generated-types-panel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
function StructureTypesCodeSection({ models, typeAliases }) {
    _s();
    const [mode, setMode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("live");
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex min-h-0 flex-1 flex-col",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center border-b border-border px-4 py-2",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex rounded-md border border-border p-0.5",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: ()=>setMode("live"),
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("rounded px-2.5 py-1 font-mono text-[10px] transition-colors", mode === "live" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"),
                            children: "Live preview"
                        }, void 0, false, {
                            fileName: "[project]/components/structure-types-code-section.tsx",
                            lineNumber: 25,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: ()=>setMode("generated"),
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("rounded px-2.5 py-1 font-mono text-[10px] transition-colors", mode === "generated" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"),
                            children: "Lint stubs"
                        }, void 0, false, {
                            fileName: "[project]/components/structure-types-code-section.tsx",
                            lineNumber: 37,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/structure-types-code-section.tsx",
                    lineNumber: 24,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/structure-types-code-section.tsx",
                lineNumber: 23,
                columnNumber: 7
            }, this),
            mode === "live" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$code$2d$view$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureCodeView"], {
                models: models,
                typeAliases: typeAliases
            }, void 0, false, {
                fileName: "[project]/components/structure-types-code-section.tsx",
                lineNumber: 53,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$generated$2d$types$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GeneratedTypesPanel"], {}, void 0, false, {
                fileName: "[project]/components/structure-types-code-section.tsx",
                lineNumber: 55,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/structure-types-code-section.tsx",
        lineNumber: 22,
        columnNumber: 5
    }, this);
}
_s(StructureTypesCodeSection, "hqZYndpYj7uQ38LkfGTdWHZVxRI=");
_c = StructureTypesCodeSection;
var _c;
__turbopack_context__.k.register(_c, "StructureTypesCodeSection");
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
"[project]/components/structure-builder.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "StructureBuilder",
    ()=>StructureBuilder
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// AI : TODO (spec) — per-structure "Quick summarise" button: cheap LLM flags inconsistencies (e.g. document_summary:int).
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/plus.mjs [app-client] (ecmascript) <export default as Plus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trash-2.mjs [app-client] (ecmascript) <export default as Trash2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$code$2d$xml$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Code2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/code-xml.mjs [app-client] (ecmascript) <export default as Code2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$layout$2d$grid$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LayoutGrid$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/layout-grid.mjs [app-client] (ecmascript) <export default as LayoutGrid>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$spreadsheet$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileSpreadsheet$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/file-spreadsheet.mjs [app-client] (ecmascript) <export default as FileSpreadsheet>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sparkles.mjs [app-client] (ecmascript) <export default as Sparkles>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/triangle-alert.mjs [app-client] (ecmascript) <export default as AlertTriangle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/lock.mjs [app-client] (ecmascript) <export default as Lock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$braces$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Braces$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/braces.mjs [app-client] (ecmascript) <export default as Braces>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$field$2d$row$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/structure-field-row.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$excel$2d$editor$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/structure-excel-editor.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$source$2d$doc$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/structure-source-doc-link.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$type$2d$alias$2d$editor$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/structure-type-alias-editor.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$window$2d$header$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/window-header.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/badge.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ui$2d$classes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/ui-classes.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$shell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/app-shell.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/store.tsx [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$id$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/id.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$types$2d$code$2d$section$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/structure-types-code-section.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$resizable$2d$split$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/resizable-split.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$editor$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/editor-split-settings.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/structure.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/builtin_models.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/builtin_types.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$validity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/structure-validity.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/type_expr.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/types.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/server/types.ts [app-client] (ecmascript) <locals>");
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
function StructureBuilder() {
    _s();
    const { models, setModels, typeAliases, setTypeAliases } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useStore"])();
    const { focusStructureId, clearFocusStructure } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$shell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAppShell"])();
    const [target, setTarget] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "StructureBuilder.useState": ()=>models[0]?.id ? {
                kind: "struct",
                id: models[0].id
            } : {
                kind: "struct",
                id: ""
            }
    }["StructureBuilder.useState"]);
    const [view, setView] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("ui");
    const savedSidebarWidth = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$editor$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useStructureSidebarWidth"])();
    const [sidebarWidth, setSidebarWidth] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$editor$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["readStructureSidebarWidth"]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "StructureBuilder.useEffect": ()=>setSidebarWidth(savedSidebarWidth)
    }["StructureBuilder.useEffect"], [
        savedSidebarWidth
    ]);
    const selectedStructId = target.kind === "struct" ? target.id : models[0]?.id ?? "";
    const selectedTypeId = target.kind === "type" ? target.id : null;
    // AI : jump here from JSON preview "validates as" links.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "StructureBuilder.useEffect": ()=>{
            if (!focusStructureId) return;
            if (!models.some({
                "StructureBuilder.useEffect": (m)=>m.id === focusStructureId
            }["StructureBuilder.useEffect"])) return;
            setTarget({
                kind: "struct",
                id: focusStructureId
            });
            setView("ui");
            clearFocusStructure();
        }
    }["StructureBuilder.useEffect"], [
        focusStructureId,
        models,
        clearFocusStructure
    ]);
    const selected = models.find((m)=>m.id === selectedStructId) ?? models[0];
    const selectedType = typeAliases.find((t)=>t.id === selectedTypeId);
    const selectedLocked = selected ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isLockedStructureModel"])(selected) : false;
    const structureIssues = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "StructureBuilder.useMemo[structureIssues]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$validity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["computeStructureIssues"])(models, typeAliases)
    }["StructureBuilder.useMemo[structureIssues]"], [
        models,
        typeAliases
    ]);
    const selectedStructIssues = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "StructureBuilder.useMemo[selectedStructIssues]": ()=>selected ? structureIssues.filter({
                "StructureBuilder.useMemo[selectedStructIssues]": (i)=>i.modelId === selected.id
            }["StructureBuilder.useMemo[selectedStructIssues]"]) : []
    }["StructureBuilder.useMemo[selectedStructIssues]"], [
        structureIssues,
        selected
    ]);
    const selectedTypeIssues = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "StructureBuilder.useMemo[selectedTypeIssues]": ()=>{
            if (!selectedType) return [];
            const name = selectedType.name.trim();
            return structureIssues.filter({
                "StructureBuilder.useMemo[selectedTypeIssues]": (i)=>i.aliasName === name || i.aliasName?.startsWith(`${name} → `)
            }["StructureBuilder.useMemo[selectedTypeIssues]"]);
        }
    }["StructureBuilder.useMemo[selectedTypeIssues]"], [
        structureIssues,
        selectedType
    ]);
    function updateModel(next) {
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isLockedStructureModel"])(next)) return;
        setModels((prev)=>prev.map((m)=>m.id === next.id ? next : m));
    }
    function addStruct() {
        const m = {
            id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$id$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uid"])(),
            name: "NewStruct",
            description: "",
            fields: [
                {
                    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$id$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uid"])(),
                    name: "field",
                    type: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Text,
                    optional: false,
                    description: ""
                }
            ]
        };
        setModels([
            ...models,
            m
        ]);
        setTarget({
            kind: "struct",
            id: m.id
        });
    }
    function addType() {
        const t = {
            id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$id$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uid"])(),
            name: "NewType",
            description: "",
            expr: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$type_expr$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UNSET_TYPE_EXPR"]
        };
        setTypeAliases([
            ...typeAliases,
            t
        ]);
        setTarget({
            kind: "type",
            id: t.id
        });
        setView("ui");
    }
    function deleteType(id) {
        const target = typeAliases.find((t)=>t.id === id);
        if (target && (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isLockedTypeAlias"])(target)) return;
        const next = typeAliases.filter((t)=>t.id !== id);
        setTypeAliases(next);
        if (selectedTypeId === id) {
            setTarget(models[0]?.id ? {
                kind: "struct",
                id: models[0].id
            } : next[0]?.id ? {
                kind: "type",
                id: next[0].id
            } : {
                kind: "struct",
                id: ""
            });
        }
    }
    function updateTypeAlias(id, patch) {
        setTypeAliases((prev)=>prev.map((t)=>t.id === id ? {
                    ...t,
                    ...patch
                } : t));
    }
    function deleteModel(id) {
        const model = models.find((m)=>m.id === id);
        if (model && (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isLockedStructureModel"])(model)) return;
        const next = models.filter((m)=>m.id !== id);
        setModels(next);
        if (target.kind === "struct" && target.id === id) {
            setTarget(next[0]?.id ? {
                kind: "struct",
                id: next[0].id
            } : {
                kind: "struct",
                id: ""
            });
        }
    }
    function addField() {
        if (!selectedStructId) return;
        setModels((prev)=>prev.map((m)=>{
                if (m.id !== selectedStructId || (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isLockedStructureModel"])(m)) return m;
                return {
                    ...m,
                    fields: [
                        ...m.fields,
                        {
                            id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$id$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uid"])(),
                            name: "field",
                            type: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FieldType"].Text,
                            optional: false,
                            description: ""
                        }
                    ]
                };
            }));
    }
    function updateField(fieldId, patch) {
        if (!selectedStructId) return;
        setModels((prev)=>prev.map((m)=>{
                if (m.id !== selectedStructId || (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isLockedStructureModel"])(m)) return m;
                return {
                    ...m,
                    fields: m.fields.map((f)=>f.id === fieldId ? {
                            ...f,
                            ...patch
                        } : f)
                };
            }));
    }
    function removeField(fieldId) {
        if (!selectedStructId) return;
        setModels((prev)=>prev.map((m)=>{
                if (m.id !== selectedStructId || (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isLockedStructureModel"])(m)) return m;
                return {
                    ...m,
                    fields: m.fields.filter((f)=>f.id !== fieldId)
                };
            }));
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex h-full flex-col",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$window$2d$header$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WindowHeader"], {
                step: "01 / Structure",
                title: "Output Structures",
                description: "Define the pydantic models your LLM must output to. Schema validation is implicit on every step's I/O.",
                actions: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center rounded-md border border-border p-0.5",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: ()=>setView("ui"),
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex items-center gap-1.5 rounded px-2 py-1 text-xs", view === "ui" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"),
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$layout$2d$grid$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LayoutGrid$3e$__["LayoutGrid"], {
                                    className: "h-3.5 w-3.5"
                                }, void 0, false, {
                                    fileName: "[project]/components/structure-builder.tsx",
                                    lineNumber: 193,
                                    columnNumber: 15
                                }, this),
                                " Form"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/structure-builder.tsx",
                            lineNumber: 184,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: ()=>setView("excel"),
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex items-center gap-1.5 rounded px-2 py-1 text-xs", view === "excel" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"),
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$spreadsheet$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileSpreadsheet$3e$__["FileSpreadsheet"], {
                                    className: "h-3.5 w-3.5"
                                }, void 0, false, {
                                    fileName: "[project]/components/structure-builder.tsx",
                                    lineNumber: 204,
                                    columnNumber: 15
                                }, this),
                                " Excel"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/structure-builder.tsx",
                            lineNumber: 195,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: ()=>setView("code"),
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex items-center gap-1.5 rounded px-2 py-1 text-xs", view === "code" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"),
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$code$2d$xml$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Code2$3e$__["Code2"], {
                                    className: "h-3.5 w-3.5"
                                }, void 0, false, {
                                    fileName: "[project]/components/structure-builder.tsx",
                                    lineNumber: 215,
                                    columnNumber: 15
                                }, this),
                                " Code"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/structure-builder.tsx",
                            lineNumber: 206,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/structure-builder.tsx",
                    lineNumber: 183,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/structure-builder.tsx",
                lineNumber: 178,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex min-h-0 flex-1",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$resizable$2d$split$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ResizableSplit"], {
                    className: "min-h-0 flex-1",
                    leadingWidth: sidebarWidth,
                    onLeadingWidthChange: setSidebarWidth,
                    onLeadingWidthCommit: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$editor$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["writeStructureSidebarWidth"],
                    minLeading: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$editor$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["STRUCTURE_SIDEBAR_MIN"],
                    maxLeading: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$editor$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["STRUCTURE_SIDEBAR_MAX"],
                    leading: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
                        className: "flex min-h-0 flex-col overflow-hidden",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-1 px-2 pt-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center justify-between px-1 py-1",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "font-mono text-[10px] uppercase tracking-wider text-muted-foreground",
                                            children: "Structs"
                                        }, void 0, false, {
                                            fileName: "[project]/components/structure-builder.tsx",
                                            lineNumber: 233,
                                            columnNumber: 21
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/components/structure-builder.tsx",
                                        lineNumber: 232,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        variant: "outline",
                                        size: "sm",
                                        className: "h-7 w-full justify-start gap-1.5 bg-transparent font-mono text-[10px]",
                                        onClick: addStruct,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                                className: "h-3.5 w-3.5"
                                            }, void 0, false, {
                                                fileName: "[project]/components/structure-builder.tsx",
                                                lineNumber: 243,
                                                columnNumber: 21
                                            }, this),
                                            " Add struct"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/structure-builder.tsx",
                                        lineNumber: 237,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/structure-builder.tsx",
                                lineNumber: 231,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "max-h-[40%] overflow-y-auto px-2 pb-2",
                                children: [
                                    models.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "px-2 py-2 text-center font-mono text-[10px] text-muted-foreground",
                                        children: "no structs yet"
                                    }, void 0, false, {
                                        fileName: "[project]/components/structure-builder.tsx",
                                        lineNumber: 248,
                                        columnNumber: 21
                                    }, this),
                                    models.map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>setTarget({
                                                    kind: "struct",
                                                    id: m.id
                                                }),
                                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("group mb-1 flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left transition-colors", target.kind === "struct" && m.id === selectedStructId ? "bg-secondary" : "hover:bg-secondary/50"),
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "min-w-0",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "break-all font-mono text-xs text-foreground",
                                                            children: m.name
                                                        }, void 0, false, {
                                                            fileName: "[project]/components/structure-builder.tsx",
                                                            lineNumber: 264,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "font-mono text-[10px] text-muted-foreground",
                                                            children: [
                                                                m.fields.length,
                                                                " fields"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/components/structure-builder.tsx",
                                                            lineNumber: 265,
                                                            columnNumber: 25
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/components/structure-builder.tsx",
                                                    lineNumber: 263,
                                                    columnNumber: 23
                                                }, this),
                                                m.auto && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__["Sparkles"], {
                                                    className: "h-3 w-3 shrink-0 text-chart-3"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/structure-builder.tsx",
                                                    lineNumber: 269,
                                                    columnNumber: 34
                                                }, this),
                                                m.sourceDocId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                    variant: "outline",
                                                    className: "h-4 shrink-0 px-1 font-mono text-[8px]",
                                                    children: "doc"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/structure-builder.tsx",
                                                    lineNumber: 271,
                                                    columnNumber: 25
                                                }, this),
                                                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isLockedStructureModel"])(m) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__["Lock"], {
                                                    className: "h-3 w-3 shrink-0 text-muted-foreground"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/structure-builder.tsx",
                                                    lineNumber: 275,
                                                    columnNumber: 53
                                                }, this)
                                            ]
                                        }, m.id, true, {
                                            fileName: "[project]/components/structure-builder.tsx",
                                            lineNumber: 253,
                                            columnNumber: 21
                                        }, this))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/structure-builder.tsx",
                                lineNumber: 246,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "border-t border-border px-2 py-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center justify-between px-1 py-1",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "font-mono text-[10px] uppercase tracking-wider text-muted-foreground",
                                            children: "Types"
                                        }, void 0, false, {
                                            fileName: "[project]/components/structure-builder.tsx",
                                            lineNumber: 282,
                                            columnNumber: 21
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/components/structure-builder.tsx",
                                        lineNumber: 281,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        variant: "outline",
                                        size: "sm",
                                        className: "mb-2 h-7 w-full justify-start gap-1.5 bg-transparent font-mono text-[10px]",
                                        onClick: addType,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                                className: "h-3.5 w-3.5"
                                            }, void 0, false, {
                                                fileName: "[project]/components/structure-builder.tsx",
                                                lineNumber: 292,
                                                columnNumber: 21
                                            }, this),
                                            " Add type"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/structure-builder.tsx",
                                        lineNumber: 286,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "max-h-[40%] overflow-y-auto",
                                        children: [
                                            typeAliases.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "px-2 py-2 text-center font-mono text-[10px] text-muted-foreground",
                                                children: "no types yet — add quote_id_t, list[int], etc."
                                            }, void 0, false, {
                                                fileName: "[project]/components/structure-builder.tsx",
                                                lineNumber: 296,
                                                columnNumber: 23
                                            }, this),
                                            typeAliases.map((t)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    onClick: ()=>{
                                                        setTarget({
                                                            kind: "type",
                                                            id: t.id
                                                        });
                                                        setView("ui");
                                                    },
                                                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors", target.kind === "type" && t.id === selectedTypeId ? "bg-secondary" : "hover:bg-secondary/50"),
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$braces$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Braces$3e$__["Braces"], {
                                                            className: "h-3 w-3 shrink-0 text-muted-foreground"
                                                        }, void 0, false, {
                                                            fileName: "[project]/components/structure-builder.tsx",
                                                            lineNumber: 314,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "min-w-0",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                    className: "truncate font-mono text-xs text-foreground",
                                                                    children: t.name
                                                                }, void 0, false, {
                                                                    fileName: "[project]/components/structure-builder.tsx",
                                                                    lineNumber: 316,
                                                                    columnNumber: 27
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                    className: "truncate font-mono text-[10px] text-muted-foreground",
                                                                    children: "type alias"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/components/structure-builder.tsx",
                                                                    lineNumber: 317,
                                                                    columnNumber: 27
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/components/structure-builder.tsx",
                                                            lineNumber: 315,
                                                            columnNumber: 25
                                                        }, this),
                                                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isLockedTypeAlias"])(t) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__["Lock"], {
                                                            className: "h-3 w-3 shrink-0 text-muted-foreground"
                                                        }, void 0, false, {
                                                            fileName: "[project]/components/structure-builder.tsx",
                                                            lineNumber: 319,
                                                            columnNumber: 50
                                                        }, this)
                                                    ]
                                                }, t.id, true, {
                                                    fileName: "[project]/components/structure-builder.tsx",
                                                    lineNumber: 301,
                                                    columnNumber: 23
                                                }, this))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/structure-builder.tsx",
                                        lineNumber: 294,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/structure-builder.tsx",
                                lineNumber: 280,
                                columnNumber: 17
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/structure-builder.tsx",
                        lineNumber: 230,
                        columnNumber: 15
                    }, this),
                    trailing: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: view === "excel" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$excel$2d$editor$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureExcelEditor"], {
                            selectedId: selectedStructId,
                            onSelectId: (id)=>setTarget({
                                    kind: "struct",
                                    id
                                })
                        }, void 0, false, {
                            fileName: "[project]/components/structure-builder.tsx",
                            lineNumber: 329,
                            columnNumber: 19
                        }, this) : view === "ui" && target.kind === "type" && selectedType ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "min-h-0 min-w-0 flex-1 overflow-y-auto",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mx-auto max-w-3xl px-5 py-5",
                                children: [
                                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isLockedTypeAlias"])(selectedType) && (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["lockedTypeAliasBanner"])(selectedType) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mb-4 flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__["Lock"], {
                                                className: "h-3.5 w-3.5 text-muted-foreground"
                                            }, void 0, false, {
                                                fileName: "[project]/components/structure-builder.tsx",
                                                lineNumber: 335,
                                                columnNumber: 27
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "font-mono text-[11px] text-muted-foreground",
                                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["lockedTypeAliasBanner"])(selectedType)
                                            }, void 0, false, {
                                                fileName: "[project]/components/structure-builder.tsx",
                                                lineNumber: 336,
                                                columnNumber: 27
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/structure-builder.tsx",
                                        lineNumber: 334,
                                        columnNumber: 25
                                    }, this),
                                    selectedTypeIssues.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mb-4 space-y-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2",
                                        children: selectedTypeIssues.map((issue, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "font-mono text-[11px] text-destructive",
                                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$validity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["structureIssueMessage"])(issue, models)
                                            }, i, false, {
                                                fileName: "[project]/components/structure-builder.tsx",
                                                lineNumber: 344,
                                                columnNumber: 29
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/components/structure-builder.tsx",
                                        lineNumber: 342,
                                        columnNumber: 25
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$type$2d$alias$2d$editor$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureTypeAliasEditor"], {
                                        alias: selectedType,
                                        models: models,
                                        typeAliases: typeAliases,
                                        locked: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isLockedTypeAlias"])(selectedType),
                                        onUpdate: (patch)=>updateTypeAlias(selectedType.id, patch),
                                        onDelete: ()=>deleteType(selectedType.id)
                                    }, void 0, false, {
                                        fileName: "[project]/components/structure-builder.tsx",
                                        lineNumber: 350,
                                        columnNumber: 23
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mt-4",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$type$2d$alias$2d$editor$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TypeAliasTextSync"], {
                                            alias: selectedType,
                                            models: models,
                                            locked: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isLockedTypeAlias"])(selectedType),
                                            onUpdate: (patch)=>updateTypeAlias(selectedType.id, patch)
                                        }, void 0, false, {
                                            fileName: "[project]/components/structure-builder.tsx",
                                            lineNumber: 359,
                                            columnNumber: 25
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/components/structure-builder.tsx",
                                        lineNumber: 358,
                                        columnNumber: 23
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/structure-builder.tsx",
                                lineNumber: 332,
                                columnNumber: 21
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/components/structure-builder.tsx",
                            lineNumber: 331,
                            columnNumber: 19
                        }, this) : view === "ui" && selected ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "min-h-0 min-w-0 flex-1 overflow-y-auto",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mx-auto max-w-3xl px-5 py-5",
                                children: [
                                    selectedLocked && (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["lockedStructureBanner"])(selected) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mb-4 flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__["Lock"], {
                                                className: "h-3.5 w-3.5 text-muted-foreground"
                                            }, void 0, false, {
                                                fileName: "[project]/components/structure-builder.tsx",
                                                lineNumber: 373,
                                                columnNumber: 27
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "font-mono text-[11px] text-muted-foreground",
                                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$builtin_models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["lockedStructureBanner"])(selected)
                                            }, void 0, false, {
                                                fileName: "[project]/components/structure-builder.tsx",
                                                lineNumber: 374,
                                                columnNumber: 27
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/structure-builder.tsx",
                                        lineNumber: 372,
                                        columnNumber: 25
                                    }, this),
                                    selected.sourceDocId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mb-4",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$source$2d$doc$2d$link$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureSourceDocLink"], {
                                            sourceDocId: selected.sourceDocId
                                        }, void 0, false, {
                                            fileName: "[project]/components/structure-builder.tsx",
                                            lineNumber: 381,
                                            columnNumber: 27
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/components/structure-builder.tsx",
                                        lineNumber: 380,
                                        columnNumber: 25
                                    }, this),
                                    selectedStructIssues.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mb-4 space-y-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2",
                                        children: selectedStructIssues.map((issue, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "font-mono text-[11px] text-destructive",
                                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$structure$2d$validity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["structureIssueMessage"])(issue, models)
                                            }, i, false, {
                                                fileName: "[project]/components/structure-builder.tsx",
                                                lineNumber: 387,
                                                columnNumber: 29
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/components/structure-builder.tsx",
                                        lineNumber: 385,
                                        columnNumber: 25
                                    }, this),
                                    selected.fields.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mb-4 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__["AlertTriangle"], {
                                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("h-3.5 w-3.5 shrink-0", __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ui$2d$classes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WARNING_TEXT_CLASS"])
                                            }, void 0, false, {
                                                fileName: "[project]/components/structure-builder.tsx",
                                                lineNumber: 395,
                                                columnNumber: 27
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("font-mono text-[11px]", __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ui$2d$classes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WARNING_TEXT_CLASS"]),
                                                children: "this model has no fields — add at least one before using it in a pipeline step"
                                            }, void 0, false, {
                                                fileName: "[project]/components/structure-builder.tsx",
                                                lineNumber: 396,
                                                columnNumber: 27
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/structure-builder.tsx",
                                        lineNumber: 394,
                                        columnNumber: 25
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mb-5 flex items-start gap-3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex-1 space-y-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                        value: selected.name,
                                                        onChange: (e)=>updateModel({
                                                                ...selected,
                                                                name: e.target.value
                                                            }),
                                                        readOnly: selectedLocked,
                                                        className: "h-9 font-mono text-sm font-medium"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/structure-builder.tsx",
                                                        lineNumber: 403,
                                                        columnNumber: 27
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                        value: selected.description,
                                                        placeholder: "Docstring describing this model…",
                                                        onChange: (e)=>updateModel({
                                                                ...selected,
                                                                description: e.target.value
                                                            }),
                                                        readOnly: selectedLocked,
                                                        className: "h-8 text-xs text-muted-foreground"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/structure-builder.tsx",
                                                        lineNumber: 409,
                                                        columnNumber: 27
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/structure-builder.tsx",
                                                lineNumber: 402,
                                                columnNumber: 25
                                            }, this),
                                            models.length > 1 && !selectedLocked && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                size: "icon",
                                                variant: "ghost",
                                                className: "h-9 w-9 text-muted-foreground hover:text-destructive",
                                                onClick: ()=>deleteModel(selected.id),
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__["Trash2"], {
                                                    className: "h-4 w-4"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/structure-builder.tsx",
                                                    lineNumber: 426,
                                                    columnNumber: 29
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/components/structure-builder.tsx",
                                                lineNumber: 420,
                                                columnNumber: 27
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/structure-builder.tsx",
                                        lineNumber: 401,
                                        columnNumber: 23
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "overflow-hidden rounded-lg border border-border",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "grid grid-cols-[1.1fr_1fr_1.2fr_1fr_auto] gap-2 border-b border-border bg-secondary/40 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: "Name"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/structure-builder.tsx",
                                                        lineNumber: 433,
                                                        columnNumber: 27
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: "Type"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/structure-builder.tsx",
                                                        lineNumber: 434,
                                                        columnNumber: 27
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: "Description"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/structure-builder.tsx",
                                                        lineNumber: 435,
                                                        columnNumber: 27
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: "Example"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/structure-builder.tsx",
                                                        lineNumber: 436,
                                                        columnNumber: 27
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-center",
                                                        title: "optional · deterministic (= exact, ≈ probabilistic) · ± tolerance on int/float",
                                                        children: "Opt · Det · ±"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/structure-builder.tsx",
                                                        lineNumber: 437,
                                                        columnNumber: 27
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/structure-builder.tsx",
                                                lineNumber: 432,
                                                columnNumber: 25
                                            }, this),
                                            selected.fields.map((f)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$field$2d$row$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureFieldRow"], {
                                                    field: f,
                                                    fields: selected.fields,
                                                    models: models,
                                                    selectedId: selected.id,
                                                    locked: selectedLocked,
                                                    onUpdate: (patch)=>updateField(f.id, patch),
                                                    onRemove: ()=>removeField(f.id)
                                                }, f.id, false, {
                                                    fileName: "[project]/components/structure-builder.tsx",
                                                    lineNumber: 442,
                                                    columnNumber: 27
                                                }, this))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/structure-builder.tsx",
                                        lineNumber: 431,
                                        columnNumber: 23
                                    }, this),
                                    !selectedLocked && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        variant: "outline",
                                        size: "sm",
                                        className: "mt-3 bg-transparent",
                                        onClick: addField,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                                className: "mr-1.5 h-3.5 w-3.5"
                                            }, void 0, false, {
                                                fileName: "[project]/components/structure-builder.tsx",
                                                lineNumber: 462,
                                                columnNumber: 27
                                            }, this),
                                            " Add field"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/structure-builder.tsx",
                                        lineNumber: 456,
                                        columnNumber: 25
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-4 font-mono text-[10px] leading-relaxed text-muted-foreground",
                                        children: "Scalars and struct refs cover common fields. Define reusable shapes under Types in the sidebar — then pick them here as field types."
                                    }, void 0, false, {
                                        fileName: "[project]/components/structure-builder.tsx",
                                        lineNumber: 466,
                                        columnNumber: 23
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/structure-builder.tsx",
                                lineNumber: 370,
                                columnNumber: 21
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/components/structure-builder.tsx",
                            lineNumber: 369,
                            columnNumber: 19
                        }, this) : view === "code" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$structure$2d$types$2d$code$2d$section$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StructureTypesCodeSection"], {
                            models: models,
                            typeAliases: typeAliases
                        }, void 0, false, {
                            fileName: "[project]/components/structure-builder.tsx",
                            lineNumber: 472,
                            columnNumber: 19
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-1 items-center justify-center",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-xs text-muted-foreground",
                                children: "No model selected."
                            }, void 0, false, {
                                fileName: "[project]/components/structure-builder.tsx",
                                lineNumber: 475,
                                columnNumber: 21
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/components/structure-builder.tsx",
                            lineNumber: 474,
                            columnNumber: 19
                        }, this)
                    }, void 0, false)
                }, void 0, false, {
                    fileName: "[project]/components/structure-builder.tsx",
                    lineNumber: 222,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/structure-builder.tsx",
                lineNumber: 221,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/structure-builder.tsx",
        lineNumber: 177,
        columnNumber: 5
    }, this);
}
_s(StructureBuilder, "C22v890LZz03tjoNCzN43OzXo+o=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$shell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAppShell"],
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$editor$2d$split$2d$settings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useStructureSidebarWidth"]
    ];
});
_c = StructureBuilder;
var _c;
__turbopack_context__.k.register(_c, "StructureBuilder");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/structure-builder.tsx [app-client] (ecmascript, next/dynamic entry)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/components/structure-builder.tsx [app-client] (ecmascript)"));
}),
]);

//# sourceMappingURL=_10~wovm._.js.map