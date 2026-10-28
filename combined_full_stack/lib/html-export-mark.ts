// AI : marks the live run pane for HTML export — serializer and UI must use these.

export const RUN_HTML_EXPORT_ROOT_ATTR = "data-run-html-export"
export const RUN_HTML_EXPORT_SKIP_ATTR = "data-html-export-skip"
export const HTML_EXPORT_ROOT_PROPS = { [RUN_HTML_EXPORT_ROOT_ATTR]: "" }
export const HTML_EXPORT_SKIP_PROPS = { [RUN_HTML_EXPORT_SKIP_ATTR]: "" }

// AI : IoSection Maximize2 — live uses React onClick; saved HTML bindHtmlPopupExpand uses these attrs.
export const HTML_EXPORT_EXPAND_ATTR = "data-html-export-expand"
export const HTML_EXPORT_EXPAND_ROOT_ATTR = "data-html-export-expand-root"
export const HTML_EXPORT_EXPAND_TITLE_ATTR = "data-html-export-expand-title"
export const HTML_EXPORT_EXPAND_PROPS = { [HTML_EXPORT_EXPAND_ATTR]: "" }
export const HTML_EXPORT_EXPAND_ROOT_PROPS = { [HTML_EXPORT_EXPAND_ROOT_ATTR]: "" }
