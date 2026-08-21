// AI : vector spine mark — mirrors logo/index.html CSS geometry

/** @typedef {"dark" | "light"} SpineTheme */
/** @typedef {"sm" | "md" | "lg" | "xl" | "tall"} SpineMarkVariant */

const MARK_SIZES = {
  sm: { size: 20, spineW: 2, nodeW: 9, nodeH: 2, wideExtra: 4 },
  md: { size: 28, spineW: 2.5, nodeW: 12, nodeH: 2.5, wideExtra: 5 },
  lg: { size: 40, spineW: 3, nodeW: 18, nodeH: 3.5, wideExtra: 6 },
  xl: { size: 56, spineW: 3, nodeW: 24, nodeH: 4, wideExtra: 6 },
  tall: { size: 18, height: 88, spineW: 3, nodeW: 12, nodeH: 3, wideExtra: 6 },
};

const THEME = {
  dark: {
    fg: "#fafafa",
    accent: "#fafafa",
    accentDim: "rgba(250,250,250,0.25)",
    accentGlow: "rgba(250,250,250,0.15)",
    dimNode: 0.55,
    midNode: 0.92,
  },
  light: {
    fg: "#18181b",
    accent: "#18181b",
    accentDim: "#a1a1aa",
    accentGlow: "transparent",
    dimNode: 0.55,
    midNode: 0.92,
  },
};

function round(n) {
  return Math.round(n * 1000) / 1000;
}

function spineGradient(theme, id) {
  const t = THEME[theme];
  if (theme === "light") {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="${t.accentDim}"/>
      <stop offset="50%" stop-color="${t.fg}"/>
      <stop offset="100%" stop-color="${t.accentDim}"/>
    </linearGradient>`;
  }
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
    <stop offset="0%" stop-color="${t.accentDim}"/>
    <stop offset="42%" stop-color="${t.accent}"/>
    <stop offset="58%" stop-color="${t.accent}"/>
    <stop offset="100%" stop-color="${t.accentDim}"/>
  </linearGradient>`;
}

function nodeRect(cx, y, w, h, fill, opacity = 1) {
  return `<rect x="${round(cx - w / 2)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${round(h / 2)}" fill="${fill}" opacity="${opacity}"/>`;
}

/** @param {{ variant?: SpineMarkVariant, theme?: SpineTheme, pad?: number, uid?: string }} opts */
export function spineMarkSvg({
  variant = "xl",
  theme = "dark",
  pad = 8,
  uid = "spine",
} = {}) {
  const cfg = MARK_SIZES[variant];
  const t = THEME[theme];
  const w = cfg.size;
  const h = cfg.height ?? cfg.size;
  const cx = w / 2;
  const gradId = `${uid}-grad`;

  const spineY = -2;
  const spineH = h + 4;
  const spineFilter =
    theme === "dark"
      ? `<filter id="${uid}-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>`
      : "";

  let nodes = "";
  if (variant === "tall") {
    const positions = [
      { y: 4, w: cfg.nodeW, accent: false },
      { y: 22, w: cfg.nodeW, accent: false },
      { y: 42, w: cfg.nodeW + cfg.wideExtra, accent: true },
      { y: 62, w: cfg.nodeW, accent: false },
      { y: h - 4 - cfg.nodeH, w: cfg.nodeW, accent: false },
    ];
    nodes = positions
      .map(({ y, w: nw, accent }) =>
        nodeRect(
          cx,
          y,
          nw,
          cfg.nodeH,
          accent ? t.accent : t.fg,
          accent ? t.midNode : t.dimNode,
        ),
      )
      .join("\n    ");
  } else {
    const midY = h / 2 - cfg.nodeH / 2;
    nodes = [
      nodeRect(cx, 5, cfg.nodeW, cfg.nodeH, t.fg, t.dimNode),
      nodeRect(cx, midY, cfg.nodeW + cfg.wideExtra, cfg.nodeH, t.accent, t.midNode),
      nodeRect(cx, h - 5 - cfg.nodeH, cfg.nodeW, cfg.nodeH, t.fg, t.dimNode),
    ].join("\n    ");
  }

  const vbX = -pad;
  const vbY = -pad - 2;
  const vbW = w + pad * 2;
  const vbH = h + pad * 2 + 4;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${vbW}" height="${vbH}" fill="none" role="img" aria-label="Spine mark">
  <defs>
    ${spineGradient(theme, gradId)}
    ${spineFilter}
  </defs>
  <rect x="${round(cx - cfg.spineW / 2)}" y="${spineY}" width="${round(cfg.spineW)}" height="${spineH}" rx="${round(cfg.spineW / 2)}" fill="url(#${gradId})"${theme === "dark" ? ` filter="url(#${uid}-glow)"` : ""}/>
  ${nodes}
</svg>`;
}

function extractMarkBody(markSvg) {
  const inner = markSvg
    .replace(/^<\?xml[^?]*\?>\n?/, "")
    .replace(/^<svg[^>]*>\n?/, "")
    .replace(/\n?<\/svg>\s*$/, "");
  const defs = inner.match(/<defs>[\s\S]*?<\/defs>/)?.[0] ?? "";
  const body = inner.replace(/<defs>[\s\S]*?<\/defs>\n?/, "");
  return { defs, body };
}

/** @param {{ theme?: SpineTheme, uid?: string }} opts */
export function spineLogoNavSvg({ theme = "dark", uid = "nav" } = {}) {
  const mark = spineMarkSvg({ variant: "sm", theme, pad: 4, uid: `${uid}-mark` });
  const { defs, body } = extractMarkBody(mark);
  const t = THEME[theme];
  const boxBg = theme === "dark" ? "#0a0a0a" : "#ffffff";
  const boxBorder = theme === "dark" ? "rgba(250,250,250,0.12)" : "#d4d4d8";
  const wordColor = theme === "dark" ? t.fg : "#18181b";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 48" width="160" height="48" fill="none" role="img" aria-label="Spine">
  <defs>${defs.replace(/^<defs>|<\/defs>$/g, "")}</defs>
  <g transform="translate(8, 8)">
    <rect x="0" y="0" width="32" height="32" rx="6" fill="${boxBg}" stroke="${boxBorder}" stroke-width="1"/>
    <g transform="translate(6, 7)">${body}</g>
  </g>
  <text x="52" y="31" font-family="Geist, Inter, system-ui, -apple-system, sans-serif" font-size="15" font-weight="600" letter-spacing="-0.45" fill="${wordColor}">Spine</text>
</svg>`;
}

/** @param {{ theme?: SpineTheme, uid?: string }} opts */
export function spineLogoHeroSvg({ theme = "dark", uid = "hero" } = {}) {
  const mark = spineMarkSvg({ variant: "lg", theme, pad: 6, uid: `${uid}-mark` });
  const { defs, body } = extractMarkBody(mark);
  const t = THEME[theme];
  const wordColor = theme === "dark" ? t.fg : "#18181b";
  const tagColor = theme === "dark" ? "#737373" : "#71717a";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 72" width="320" height="72" fill="none" role="img" aria-label="Spine validated AI">
  <defs>${defs.replace(/^<defs>|<\/defs>$/g, "")}</defs>
  <g transform="translate(0, 8)">${body}</g>
  <text x="58" y="36" font-family="Geist, Inter, system-ui, -apple-system, sans-serif" font-size="28" font-weight="600" letter-spacing="-0.84" fill="${wordColor}">Spine</text>
  <text x="58" y="56" font-family="Geist Mono, SF Mono, ui-monospace, monospace" font-size="10" letter-spacing="0.2" fill="${tagColor}">validated AI</text>
</svg>`;
}

/** @param {{ theme?: SpineTheme, uid?: string }} opts */
export function spineLogoVerticalSvg({ theme = "dark", uid = "vertical" } = {}) {
  const mark = spineMarkSvg({ variant: "tall", theme, pad: 4, uid: `${uid}-mark` });
  const { defs, body } = extractMarkBody(mark);
  const t = THEME[theme];
  const dim = theme === "dark" ? "rgba(250,250,250,0.55)" : "rgba(24,24,27,0.55)";
  const mid = theme === "dark" ? t.accent : "#18181b";
  const letters = ["S", "P", "I", "N", "E"];
  const letterYs = [13, 31, 49, 67, 85];

  const letterNodes = letters
    .map((letter, i) => {
      const fill = letter === "I" ? mid : dim;
      return `<text x="34" y="${letterYs[i]}" font-family="Geist, Inter, system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" letter-spacing="1.04" fill="${fill}">${letter}</text>`;
    })
    .join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 96" width="56" height="96" fill="none" role="img" aria-label="Spine">
  <defs>${defs.replace(/^<defs>|<\/defs>$/g, "")}</defs>
  <g transform="translate(0, 4)">${body}</g>
  ${letterNodes}
</svg>`;
}
