// AI : one HTML shell + Geist CSS — run-pane export and json-viewer srcdoc iframes.

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

export function embedCss(css: string): string {
  return css.replace(/<\/style/gi, "<\\/style")
}

export function embedScript(js: string): string {
  return js.replace(/<\/script/gi, "<\\/script")
}

export function standaloneFontFacesCss(): string {
  return `
@font-face {
  font-family: "Geist";
  font-style: normal;
  font-display: swap;
  font-weight: 100 900;
  src: url("https://cdn.jsdelivr.net/npm/@fontsource-variable/geist@5.2.5/files/geist-latin-wght-normal.woff2") format("woff2-variations");
}
@font-face {
  font-family: "Geist Mono";
  font-style: normal;
  font-display: swap;
  font-weight: 100 900;
  src: url("https://cdn.jsdelivr.net/npm/@fontsource-variable/geist-mono@5.2.5/files/geist-mono-latin-wght-normal.woff2") format("woff2-variations");
}
`
}

export function standaloneFontVarsCss(important = false): string {
  const bang = important ? " !important" : ""
  return `html {
  --font-geist-sans: "Geist", ui-sans-serif, system-ui, sans-serif${bang};
  --font-geist-mono: "Geist Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace${bang};
  --font-sans: var(--font-geist-sans)${bang};
  --font-mono: var(--font-geist-mono)${bang};
}`
}

const STANDALONE_FONT_APPLY_CSS = `
body {
  font-family: var(--font-sans) !important;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
button, input { font-family: inherit !important; }
#json-code, .inline-json-root, .excel-table, .tree-root, .j-content, .j-line, pre {
  font-family: var(--font-mono) !important;
}
`

export function standaloneFontCss(important = false): string {
  return `${standaloneFontFacesCss()}\n${standaloneFontVarsCss(important)}\n${STANDALONE_FONT_APPLY_CSS}`
}

export function injectHeadStyle(html: string, css: string): string {
  const extra = `<style>${css}</style>`
  return html.includes("</head>") ? html.replace("</head>", `${extra}</head>`) : extra + html
}

export function withStandaloneFonts(html: string): string {
  return injectHeadStyle(html, standaloneFontCss())
}

export function standalonePageShellCss(widthPx: number): string {
  return `
html, body {
  height: auto !important;
  min-height: 100%;
  overflow: auto !important;
  display: block !important;
}
body { margin: 0; background: var(--background); color: var(--foreground); }
#run-html-export { max-width: ${widthPx}px; margin: 0 auto; }
`
}

export function standaloneDocument(opts: {
  title: string
  htmlClass?: string
  colorScheme?: string
  bodyClass?: string
  styles: string[]
  bodyHtml: string
  scripts?: string[]
}): string {
  const htmlAttrs = [
    'lang="en"',
    opts.htmlClass ? `class="${escapeHtml(opts.htmlClass)}"` : "",
    opts.colorScheme ? `data-color-scheme="${escapeHtml(opts.colorScheme)}"` : "",
  ]
    .filter(Boolean)
    .join(" ")
  const styles = opts.styles.map((css) => `<style>${embedCss(css)}</style>`).join("\n")
  const scripts = (opts.scripts ?? []).map((s) => `<script>${embedScript(s)}</script>`).join("\n")
  const bodyClass = opts.bodyClass ? ` class="${escapeHtml(opts.bodyClass)}"` : ""
  return `<!doctype html>
<html ${htmlAttrs}>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(opts.title)}</title>
${styles}
</head>
<body${bodyClass}>
${opts.bodyHtml}
${scripts}
</body>
</html>`
}
