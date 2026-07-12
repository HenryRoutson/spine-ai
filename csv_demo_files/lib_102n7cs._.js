(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/lib/shared/legal/site.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LEGAL",
    ()=>LEGAL,
    "LEGAL_ROUTES",
    ()=>LEGAL_ROUTES
]);
const LEGAL = {
    productName: "Spine",
    controllerName: "Spine (Antler hackathon project)",
    contactEmail: "spine-ai.dev@proton.me",
    policyVersion: "2026-07-08",
    lastUpdated: "8 July 2026",
    minAgeYears: 16
};
const LEGAL_ROUTES = {
    privacy: "/privacy",
    terms: "/terms",
    cookies: "/cookies",
    accessibility: "/accessibility"
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/legal/cookie-consent.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CookieConsentBanner",
    ()=>CookieConsentBanner,
    "readCookieConsent",
    ()=>readCookieConsent,
    "writeCookieConsent",
    ()=>writeCookieConsent
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$shared$2f$legal$2f$site$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/shared/legal/site.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
const STORAGE_KEY = "cookie_consent_v1";
function readCookieConsent() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "essential_only" || raw === "all" ? raw : null;
}
function writeCookieConsent(choice) {
    localStorage.setItem(STORAGE_KEY, choice);
    document.cookie = `${STORAGE_KEY}=${choice};path=/;max-age=31536000;SameSite=Lax`;
}
function CookieConsentBanner({ acceptClassName = "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground", rejectClassName = "rounded-md border px-3 py-1.5 text-xs", panelClassName = "fixed bottom-0 inset-x-0 z-50 border-t bg-background/95 p-4 backdrop-blur-sm", messageClassName = "text-sm leading-relaxed text-muted-foreground" }) {
    _s();
    const [visible, setVisible] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CookieConsentBanner.useEffect": ()=>{
            setVisible(readCookieConsent() === null);
        }
    }["CookieConsentBanner.useEffect"], []);
    function choose(choice) {
        writeCookieConsent(choice);
        setVisible(false);
    }
    if (!visible) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        role: "dialog",
        "aria-label": "Cookie consent",
        className: panelClassName,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: messageClassName,
                    children: [
                        "We use essential cookies for sign-in and security. Optional analytics are off unless you accept. See our",
                        " ",
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            href: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$shared$2f$legal$2f$site$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LEGAL_ROUTES"].cookies,
                            className: "underline underline-offset-2",
                            children: "Cookie Policy"
                        }, void 0, false, {
                            fileName: "[project]/lib/legal/cookie-consent.tsx",
                            lineNumber: 54,
                            columnNumber: 11
                        }, this),
                        "."
                    ]
                }, void 0, true, {
                    fileName: "[project]/lib/legal/cookie-consent.tsx",
                    lineNumber: 51,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex shrink-0 flex-wrap gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            className: rejectClassName,
                            onClick: ()=>choose("essential_only"),
                            children: "Essential only"
                        }, void 0, false, {
                            fileName: "[project]/lib/legal/cookie-consent.tsx",
                            lineNumber: 60,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            className: acceptClassName,
                            onClick: ()=>choose("all"),
                            children: "Accept all"
                        }, void 0, false, {
                            fileName: "[project]/lib/legal/cookie-consent.tsx",
                            lineNumber: 63,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/lib/legal/cookie-consent.tsx",
                    lineNumber: 59,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/lib/legal/cookie-consent.tsx",
            lineNumber: 50,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/lib/legal/cookie-consent.tsx",
        lineNumber: 49,
        columnNumber: 5
    }, this);
}
_s(CookieConsentBanner, "cz/DzCD06IMMsoBJ0A1IgCy1P5M=");
_c = CookieConsentBanner;
var _c;
__turbopack_context__.k.register(_c, "CookieConsentBanner");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=lib_102n7cs._.js.map